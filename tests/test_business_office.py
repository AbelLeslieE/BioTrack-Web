import unittest
import asyncio
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from backend.models import Base
from backend.models.business import BusinessTransaction, SupplierInvoice, SupplierPayment
from backend.models.user import User
from backend.routes.business_routes import (
    business_dashboard,
    complete_supplier_payment,
    create_business_contract,
    create_claim,
    create_goods_receipt,
    create_policy,
    create_purchase,
    create_purchase_order,
    create_quotation,
    create_supplier_invoice,
    create_vendor,
    decide_supplier_invoice,
    decide_supplier_payment,
    decide_purchase,
    download_business_document,
    request_supplier_payment,
    reconcile_supplier_tax,
    refresh_invoice_match,
    save_budget,
    select_quotation,
    update_claim,
    update_purchase_status,
    update_quotation,
    update_vendor,
    upload_business_document,
)
from backend.schemas.business_schema import (
    BudgetInput,
    BusinessContractInput,
    ClaimBatchInput,
    ClaimBatchUpdate,
    GoodsReceiptInput,
    InvoiceDecision,
    InvoiceInput,
    PaymentCompletion,
    PaymentDecision,
    PaymentRequestInput,
    PolicyInput,
    PurchaseDecision,
    PurchaseInput,
    PurchaseOrderInput,
    PurchaseStatusUpdate,
    QuotationInput,
    TaxReconciliationInput,
    VendorInput,
)


class BusinessOfficeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.business_user = User(username="business", password_hash="x", name="Business Officer", role="Business", department="Business Office", is_active=True)
        self.manager = User(username="manager", password_hash="x", name="Administrator", role="Manager", department="Administration", is_active=True)
        self.db.add_all([self.business_user, self.manager])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_purchase_payment_updates_budget_without_double_counting(self):
        budget = save_budget(BudgetInput(fiscal_year="2026-27", department="Radiology", category="Equipment", allocated_amount=100_000), None, self.db, self.business_user)
        purchase = create_purchase(PurchaseInput(budget_id=budget["id"], department="Radiology", category="Equipment", item_name="Patient monitor", quantity=2, unit="units", unit_cost=15_000, justification="Replace two unsupported monitors"), None, self.db, self.business_user)
        self.assertEqual(purchase["total_amount"], 30_000)

        decide_purchase(purchase["id"], PurchaseDecision(decision="Approved", note="Within approved capital plan"), None, self.db, self.manager)
        summary = business_dashboard("2026-27", self.db)
        self.assertEqual(summary["summary"]["committed_spend"], 30_000)
        self.assertEqual(summary["summary"]["paid_spend"], 0)

        for status in ("Ordered", "Received", "Paid"):
            update_purchase_status(purchase["id"], PurchaseStatusUpdate(status=status, payment_method="NEFT" if status == "Paid" else "", invoice_number="INV-1" if status == "Paid" else ""), None, self.db, self.business_user)

        summary = business_dashboard("2026-27", self.db)
        self.assertEqual(summary["summary"]["committed_spend"], 0)
        self.assertEqual(summary["summary"]["paid_spend"], 30_000)
        self.assertEqual(summary["summary"]["available_budget"], 70_000)
        self.assertEqual(self.db.query(BusinessTransaction).filter(BusinessTransaction.source_type == "purchase").count(), 1)

    def test_aggregate_claim_receipt_posts_income_without_patient_data(self):
        today = date.today()
        policy = create_policy(PolicyInput(provider_name="State Health Agency", policy_name="Public Health Scheme", policy_code="PHS-1", payer_type="Government Scheme", coverage_model="Package Rate", valid_from=today, valid_to=today + timedelta(days=365)), None, self.db, self.business_user)
        claim = create_claim(ClaimBatchInput(batch_reference="BATCH-2026-01", policy_id=policy["id"], service_period_start=today - timedelta(days=30), service_period_end=today, claim_count=18, claimed_amount=250_000, status="Submitted"), None, self.db, self.business_user)
        updated = update_claim(claim["id"], ClaimBatchUpdate(approved_amount=220_000, received_amount=200_000, status="Partially Paid"), None, self.db, self.business_user)

        self.assertEqual(updated["outstanding_amount"], 20_000)
        self.assertEqual(updated["deductions_amount"], 30_000)
        receipt = self.db.query(BusinessTransaction).filter(BusinessTransaction.source_type == "insurance_claim").one()
        self.assertEqual(receipt.amount, 200_000)
        self.assertEqual(receipt.status, "Received")
        self.assertFalse(any("patient" in column.name.casefold() for table in (Base.metadata.tables["insurance_claim_batches"],) for column in table.columns))

    def test_quotation_invoice_and_partial_payment_workflow(self):
        today = date.today()
        budget = save_budget(BudgetInput(fiscal_year="2026-27", department="Radiology", category="Equipment", allocated_amount=Decimal("100000.00")), None, self.db, self.business_user)
        purchase = create_purchase(PurchaseInput(budget_id=budget["id"], department="Radiology", category="Equipment", item_name="Patient monitor", quantity=Decimal("2"), unit="units", unit_cost=Decimal("0"), justification="Replace unsupported monitors"), None, self.db, self.business_user)
        vendor_a = create_vendor(VendorInput(vendor_name="Alpha Medical", payment_terms_days=30), None, self.db, self.business_user)
        vendor_b = create_vendor(VendorInput(vendor_name="Beta Healthcare", payment_terms_days=45), None, self.db, self.business_user)
        self.assertEqual(vendor_a["vendor_code"], "VEN-001")
        self.assertEqual(vendor_b["vendor_code"], "VEN-002")

        quote_a = create_quotation(purchase["id"], QuotationInput(vendor_id=vendor_a["id"], quote_number="QA-1", quote_date=today, quantity=Decimal("2"), unit_price=Decimal("10000.10"), tax_amount=Decimal("3600.04"), discount_amount=Decimal("100.00"), delivery_days=14, warranty_months=24), None, self.db, self.business_user)
        quote_b = create_quotation(purchase["id"], QuotationInput(vendor_id=vendor_b["id"], quote_number="QB-1", quote_date=today, quantity=Decimal("2"), unit_price=Decimal("11000.00"), tax_amount=Decimal("3960.00"), delivery_days=7, warranty_months=36), None, self.db, self.business_user)
        self.assertEqual(quote_a["total_amount"], Decimal("23500.24"))
        self.assertTrue(quote_b["is_recommended"])
        self.assertEqual(quote_b["evaluation_rank"], 1)
        self.assertGreater(quote_b["evaluation_score"], Decimal("90"))
        self.assertIn("Longest warranty", quote_b["evaluation_reasons"])
        selected = select_quotation(quote_a["id"], None, self.db, self.manager)
        self.assertEqual(selected["status"], "Selected")
        self.assertLess(quote_a["total_amount"], quote_b["total_amount"])

        decide_purchase(purchase["id"], PurchaseDecision(decision="Approved", note="Best evaluated quotation"), None, self.db, self.manager)
        update_purchase_status(purchase["id"], PurchaseStatusUpdate(status="Ordered"), None, self.db, self.business_user)
        update_purchase_status(purchase["id"], PurchaseStatusUpdate(status="Received"), None, self.db, self.business_user)
        invoice = create_supplier_invoice(InvoiceInput(purchase_id=purchase["id"], vendor_id=vendor_a["id"], quotation_id=quote_a["id"], invoice_number="INV-A-1", invoice_date=today, due_date=today + timedelta(days=30), subtotal_amount=Decimal("19900.20"), tax_amount=Decimal("3600.04")), None, self.db, self.business_user)
        approved = decide_supplier_invoice(invoice["id"], InvoiceDecision(decision="Approved", approved_amount=Decimal("23500.24"), note="Matched to delivery and quotation"), None, self.db, self.manager)
        self.assertEqual(approved["outstanding_amount"], Decimal("23500.24"))

        first = request_supplier_payment(invoice["id"], PaymentRequestInput(amount=Decimal("10000.12"), requested_payment_date=today, request_note="First instalment"), None, self.db, self.business_user)
        with self.assertRaises(HTTPException):
            request_supplier_payment(invoice["id"], PaymentRequestInput(amount=Decimal("20000.00"), requested_payment_date=today), None, self.db, self.business_user)
        decide_supplier_payment(first["id"], PaymentDecision(decision="Approved", note="Approved partial payment"), None, self.db, self.manager)
        complete_supplier_payment(first["id"], PaymentCompletion(paid_date=today, payment_method="NEFT", bank_reference="BANK-1"), None, self.db, self.business_user)
        stored_invoice = self.db.get(SupplierInvoice, invoice["id"])
        self.assertEqual(stored_invoice.paid_amount, Decimal("10000.12"))
        self.assertEqual(stored_invoice.status, "Partially Paid")
        partial_dashboard = business_dashboard("2026-27", self.db)
        self.assertEqual(partial_dashboard["summary"]["committed_spend"], Decimal("13500.12"))
        self.assertEqual(partial_dashboard["summary"]["paid_spend"], Decimal("10000.12"))
        self.assertEqual(partial_dashboard["summary"]["available_budget"], Decimal("76499.76"))

        second = request_supplier_payment(invoice["id"], PaymentRequestInput(amount=Decimal("13500.12"), requested_payment_date=today), None, self.db, self.business_user)
        decide_supplier_payment(second["id"], PaymentDecision(decision="Approved"), None, self.db, self.manager)
        complete_supplier_payment(second["id"], PaymentCompletion(paid_date=today, payment_method="NEFT", bank_reference="BANK-2"), None, self.db, self.business_user)
        self.db.refresh(stored_invoice)
        self.assertEqual(stored_invoice.paid_amount, Decimal("23500.24"))
        self.assertEqual(stored_invoice.status, "Paid")
        self.assertEqual(self.db.query(SupplierPayment).filter(SupplierPayment.status == "Paid").count(), 2)
        self.assertEqual(self.db.query(BusinessTransaction).filter(BusinessTransaction.source_type == "supplier_payment").count(), 2)

        dashboard = business_dashboard("2026-27", self.db)
        self.assertEqual(dashboard["summary"]["supplier_outstanding"], Decimal("0.00"))
        self.assertEqual(next(row for row in dashboard["quotations"] if row["id"] == quote_a["id"])["status"], "Selected")
        evaluated_a = next(row for row in dashboard["quotations"] if row["id"] == quote_a["id"])
        evaluated_b = next(row for row in dashboard["quotations"] if row["id"] == quote_b["id"])
        self.assertTrue(evaluated_b["is_recommended"])
        self.assertGreater(evaluated_b["evaluation_score"], evaluated_a["evaluation_score"])
        self.assertGreater(evaluated_b["advantage_percent"], Decimal("20"))

    def test_invoice_document_is_stored_in_database(self):
        vendor = create_vendor(VendorInput(vendor_name="Document Vendor"), None, self.db, self.business_user)
        buffer = BytesIO()
        Image.new("RGB", (80, 60), "white").save(buffer, format="PNG")
        buffer.seek(0)
        upload = UploadFile(filename="vendor-tax.png", file=buffer, headers=Headers({"content-type": "image/png"}))
        document = asyncio.run(upload_business_document("vendor", vendor["id"], None, "Tax Document", upload, self.db, self.business_user))
        response = download_business_document(document["id"], self.db)
        self.assertTrue(response.body)
        self.assertEqual(response.media_type, "image/jpeg")

    def test_quotation_details_can_be_edited_before_order(self):
        today = date.today()
        purchase = create_purchase(PurchaseInput(department="ICU", category="Equipment", item_name="Bedside monitor", quantity=2, unit="units", unit_cost=0, justification="Replace unsupported monitors"), None, self.db, self.business_user)
        vendor = create_vendor(VendorInput(vendor_name="Clinical Systems", email="sales@example.test", phone="+91 90000 00000", address="Thrissur, Kerala"), None, self.db, self.business_user)
        quotation = create_quotation(purchase["id"], QuotationInput(vendor_id=vendor["id"], quote_number="QT-DETAIL-1", quote_date=today, valid_until=today + timedelta(days=30), quantity=2, unit_price=100, installation_amount=50, installation_details="On-site installation", freight_amount=10, discount_amount=10, tax_rate=18, delivery_days=10, warranty_months=36, amc_annual_amount=25, amc_years=3, amc_terms="After warranty", training_included=True, training_details="Clinical user training", additional_conditions="30% advance\nBalance after installation"), None, self.db, self.business_user)
        self.assertEqual(quotation["subtotal_amount"], Decimal("260.00"))
        self.assertEqual(quotation["tax_amount"], Decimal("45.00"))
        self.assertEqual(quotation["total_amount"], Decimal("295.00"))
        self.assertEqual(quotation["vendor_address"], "Thrissur, Kerala")

        updated = update_quotation(quotation["id"], QuotationInput(vendor_id=vendor["id"], quote_number="QT-DETAIL-1", quote_date=today, valid_until=today + timedelta(days=45), quantity=2, unit_price=100, installation_amount=100, installation_details="Installation and commissioning", freight_amount=20, discount_amount=20, tax_rate=18, delivery_days=7, warranty_months=48, amc_annual_amount=30, amc_years=4, amc_terms="Comprehensive AMC", training_included=True, training_details="Two training sessions", additional_conditions="40% advance\n60% after installation"), None, self.db, self.business_user)
        self.assertEqual(updated["tax_amount"], Decimal("54.00"))
        self.assertEqual(updated["total_amount"], Decimal("354.00"))
        self.assertEqual(updated["warranty_months"], 48)
        self.assertEqual(updated["additional_conditions"], "40% advance\n60% after installation")

    def test_vendor_number_is_automatic_and_immutable(self):
        vendor = create_vendor(VendorInput(vendor_name="Automatic Number Supplier"), None, self.db, self.business_user)
        self.assertEqual(vendor["vendor_code"], "VEN-001")

        updated = update_vendor(vendor["id"], VendorInput(vendor_name="Renamed Supplier", payment_terms_days=45), None, self.db, self.business_user)
        self.assertEqual(updated["vendor_code"], "VEN-001")
        self.assertEqual(updated["vendor_name"], "Renamed Supplier")

    def test_procure_to_pay_contract_forecast_gst_and_tds_controls(self):
        today = date.today()
        purchase = create_purchase(PurchaseInput(department="Biomedical", category="Equipment", item_name="Infusion pumps", quantity=Decimal("2"), unit="units", unit_cost=Decimal("0"), justification="Replace end-of-life pumps"), None, self.db, self.business_user)
        vendor = create_vendor(VendorInput(vendor_name="Controlled Medical", tax_identifier="32ABCDE1234F1Z5", payment_terms_days=30), None, self.db, self.business_user)
        quotation = create_quotation(purchase["id"], QuotationInput(vendor_id=vendor["id"], quote_number="QT-CONTROL-1", quote_date=today, quantity=Decimal("2"), unit_price=Decimal("500.00"), tax_amount=Decimal("180.00"), warranty_months=36), None, self.db, self.business_user)
        select_quotation(quotation["id"], None, self.db, self.manager)
        decide_purchase(purchase["id"], PurchaseDecision(decision="Approved", note="Approved after comparison"), None, self.db, self.manager)

        order = create_purchase_order(PurchaseOrderInput(purchase_id=purchase["id"], quotation_id=quotation["id"], order_date=today, expected_delivery_date=today + timedelta(days=7), delivery_address="Little Flower Hospital central receiving"), None, self.db, self.business_user)
        first_receipt = create_goods_receipt(GoodsReceiptInput(purchase_order_id=order["id"], received_date=today, quantity_received=Decimal("1"), quantity_accepted=Decimal("1"), inspection_status="Partially Accepted", received_by="Stores"), None, self.db, self.business_user)
        self.assertEqual(first_receipt["quantity_accepted"], Decimal("1"))
        invoice = create_supplier_invoice(InvoiceInput(purchase_id=purchase["id"], vendor_id=vendor["id"], quotation_id=quotation["id"], purchase_order_id=order["id"], goods_receipt_id=first_receipt["id"], invoice_number="INV-CONTROL-1", invoice_date=today, due_date=today + timedelta(days=30), subtotal_amount=Decimal("1000.00"), tax_amount=Decimal("180.00"), tds_section="194C", tds_rate=Decimal("2.00")), None, self.db, self.business_user)
        self.assertEqual(invoice["match_status"], "Mismatch")
        with self.assertRaises(HTTPException):
            decide_supplier_invoice(invoice["id"], InvoiceDecision(decision="Approved", approved_amount=Decimal("1180.00")), None, self.db, self.manager)
        create_goods_receipt(GoodsReceiptInput(purchase_order_id=order["id"], received_date=today, quantity_received=Decimal("1"), quantity_accepted=Decimal("1"), inspection_status="Accepted", received_by="Stores"), None, self.db, self.business_user)
        self.assertEqual(invoice["tds_amount"], Decimal("20.00"))
        self.assertEqual(invoice["net_payable_amount"], Decimal("1160.00"))
        self.assertEqual(refresh_invoice_match(invoice["id"], None, self.db, self.business_user)["match_status"], "Matched")

        tax = reconcile_supplier_tax(invoice["id"], TaxReconciliationInput(return_period=f"{today.year}-{today.month:02d}", supplier_gstin="32ABCDE1234F1Z5", gstr2b_status="Matched", taxable_amount=Decimal("1000.00"), gst_amount=Decimal("180.00"), eligible_itc_amount=Decimal("180.00")), None, self.db, self.business_user)
        self.assertEqual(tax["discrepancy_amount"], Decimal("0.00"))

        contract = create_business_contract(BusinessContractInput(vendor_id=vendor["id"], purchase_order_id=order["id"], contract_number="AMC-2026-001", title="Infusion pump comprehensive AMC", contract_type="AMC", owner_department="Biomedical", start_date=today, end_date=today + timedelta(days=20), total_value=Decimal("12000.00"), billing_frequency="Annual", next_payment_date=today + timedelta(days=10), next_payment_amount=Decimal("12000.00"), renewal_notice_days=60, response_sla_hours=8, service_obligations="Quarterly preventive maintenance and 8-hour breakdown response", payment_schedule="Annual payment after service verification"), None, self.db, self.business_user)
        self.assertEqual(contract["days_to_expiry"], 20)
        dashboard = business_dashboard(None, self.db)
        self.assertTrue(any(item["kind"] == "Contract" for item in dashboard["management_alerts"]))
        self.assertTrue(any(item["reference"] == "AMC-2026-001" for item in dashboard["cashflow_forecast"]["items"]))
        self.assertEqual(dashboard["tax_reconciliations"][0]["gstr2b_status"], "Matched")


if __name__ == "__main__":
    unittest.main()
