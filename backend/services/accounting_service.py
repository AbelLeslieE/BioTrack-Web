"""Exact-decimal accounting and GST helpers used by the native finance API."""

from decimal import Decimal, ROUND_HALF_UP

from backend.schemas.accounting_schema import GSTCalculationInput


MONEY = Decimal("0.01")
RATE = Decimal("0.0001")
HUNDRED = Decimal("100")


def money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def rate(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(RATE, rounding=ROUND_HALF_UP)


def calculate_gst(data: GSTCalculationInput) -> dict[str, object]:
    """Return an invoice-grade GST preview without using binary floating point.

    GST is split by place of supply: intra-state supplies use equal CGST/SGST,
    while inter-state supplies use IGST.  A one-paisa split remainder is kept in
    SGST so the components always reconcile exactly to the rounded GST total.
    """

    intra_state = data.supplier_state_code == data.place_of_supply_code
    rows: list[dict[str, object]] = []
    totals = {
        "gross_amount": Decimal("0.00"),
        "discount_amount": Decimal("0.00"),
        "taxable_amount": Decimal("0.00"),
        "cgst_amount": Decimal("0.00"),
        "sgst_amount": Decimal("0.00"),
        "igst_amount": Decimal("0.00"),
        "cess_amount": Decimal("0.00"),
        "grand_total": Decimal("0.00"),
    }

    for index, line in enumerate(data.lines, start=1):
        gross = money(line.quantity * line.unit_price)
        discount = money(line.discount_amount)
        if discount > gross:
            raise ValueError(f"Line {index} discount cannot exceed its gross amount.")
        after_discount = money(gross - discount)
        gst_rate = rate(line.gst_rate)
        cess_rate = rate(line.cess_rate)
        combined_rate = gst_rate + cess_rate

        if line.tax_inclusive and combined_rate:
            taxable = money(after_discount * HUNDRED / (HUNDRED + combined_rate))
            combined_tax = money(after_discount - taxable)
            gst_amount = money(combined_tax * gst_rate / combined_rate) if combined_rate else Decimal("0.00")
            cess = money(combined_tax - gst_amount)
        else:
            taxable = after_discount
            gst_amount = money(taxable * gst_rate / HUNDRED)
            cess = money(taxable * cess_rate / HUNDRED)

        if intra_state:
            cgst = money(gst_amount / Decimal("2"))
            sgst = money(gst_amount - cgst)
            igst = Decimal("0.00")
        else:
            cgst = Decimal("0.00")
            sgst = Decimal("0.00")
            igst = gst_amount

        total = after_discount if line.tax_inclusive else money(taxable + gst_amount + cess)
        row = {
            "line_number": index,
            "description": line.description,
            "hsn_sac": line.hsn_sac,
            "quantity": line.quantity,
            "unit_price": money(line.unit_price),
            "gross_amount": gross,
            "discount_amount": discount,
            "taxable_amount": taxable,
            "gst_rate": gst_rate,
            "cess_rate": cess_rate,
            "cgst_amount": cgst,
            "sgst_amount": sgst,
            "igst_amount": igst,
            "cess_amount": cess,
            "line_total": total,
            "tax_inclusive": line.tax_inclusive,
        }
        rows.append(row)
        for key in totals:
            if key == "grand_total":
                totals[key] += total
            elif key in row:
                totals[key] += row[key]  # type: ignore[operator]

    totals = {key: money(value) for key, value in totals.items()}
    return {
        "tax_regime": "Intra-state" if intra_state else "Inter-state",
        "supplier_state_code": data.supplier_state_code,
        "place_of_supply_code": data.place_of_supply_code,
        "reverse_charge": data.reverse_charge,
        "lines": rows,
        "totals": totals,
        "rounding_difference": Decimal("0.00"),
        "calculation_engine": "BioTrack exact-decimal GST v1",
    }


def validate_balanced_lines(lines) -> tuple[Decimal, Decimal]:
    total_debit = money(sum((money(line.debit) for line in lines), Decimal("0")))
    total_credit = money(sum((money(line.credit) for line in lines), Decimal("0")))
    if total_debit <= 0:
        raise ValueError("A journal entry must have a positive debit and credit total.")
    if total_debit != total_credit:
        raise ValueError(
            f"Journal entry is not balanced: debit {total_debit} does not equal credit {total_credit}."
        )
    return total_debit, total_credit

