-- BioTrack database schema
-- Version 2.0 - mirrors the current SQLAlchemy models and migrations.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    department TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('Manager', 'BME', 'Electrical', 'IT', 'User', 'WardBoy', 'CentralStore', 'Business')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP,
    mfa_enabled BOOLEAN NOT NULL DEFAULT 0,
    mfa_secret TEXT,
    mfa_pending_secret TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL,
    last_seen_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS security_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    actor_user_id INTEGER,
    actor_username TEXT,
    target_type TEXT,
    target_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_code TEXT NOT NULL UNIQUE,
    department_name TEXT NOT NULL UNIQUE,
    building TEXT,
    floor TEXT,
    hod TEXT,
    status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS manufacturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer_name TEXT NOT NULL UNIQUE,
    address TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_name TEXT NOT NULL UNIQUE,
    address TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code TEXT NOT NULL UNIQUE,
    equipment_no TEXT UNIQUE,
    equipment_name TEXT NOT NULL,
    classification TEXT,
    equipment_type TEXT,
    manufacturer TEXT,
    manufacturer_address TEXT,
    model TEXT,
    serial_number TEXT UNIQUE,
    manufacturing_year INTEGER,
    maintained_by TEXT,
    service_team TEXT NOT NULL DEFAULT 'Biomedical'
        CHECK (service_team IN ('Biomedical', 'Electrical', 'IT')),
    supplier TEXT,
    purchase_value REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    net_value REAL DEFAULT 0,
    purchase_date DATE,
    installation_date DATE,
    warranty TEXT,
    department TEXT,
    location TEXT,
    status TEXT DEFAULT 'Active',
    pm_frequency INTEGER,
    calibration_required BOOLEAN DEFAULT 0,
    remarks TEXT,
    image_path TEXT,
    qr_generated BOOLEAN DEFAULT 0,
    qr_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    document_name TEXT NOT NULL,
    document_type TEXT,
    file_path TEXT NOT NULL,
    file_data BLOB,
    content_type TEXT NOT NULL DEFAULT 'application/pdf',
    original_size_bytes INTEGER NOT NULL DEFAULT 0,
    stored_size_bytes INTEGER NOT NULL DEFAULT 0,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    action TEXT,
    description TEXT,
    performed_by TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_spares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    part_name TEXT,
    part_number TEXT,
    vendor TEXT,
    cost REAL,
    replacement_date DATE,
    replaced_by TEXT,
    remarks TEXT,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_relocation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    requested_by TEXT NOT NULL,
    requester_department TEXT NOT NULL,
    service_team TEXT NOT NULL,
    from_department TEXT,
    from_location TEXT,
    target_department TEXT NOT NULL,
    target_location TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    reviewed_by TEXT,
    review_note TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT,
    device_type TEXT,
    model TEXT,
    serial_number TEXT UNIQUE,
    purchased_year INTEGER
);

CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bpk_number TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT,
    manufacturer TEXT,
    supplier TEXT,
    unit TEXT,
    current_stock INTEGER DEFAULT 0,
    reserved_stock INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER DEFAULT 5,
    maximum_stock INTEGER DEFAULT 100,
    location TEXT,
    rack TEXT,
    batch_number TEXT,
    purchase_price REAL DEFAULT 0,
    remarks TEXT,
    service_team TEXT NOT NULL DEFAULT 'Biomedical'
        CHECK (service_team IN ('Biomedical', 'Electrical', 'IT')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_service_team_bpk UNIQUE (service_team, bpk_number)
);

CREATE TABLE IF NOT EXISTS central_store_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT NOT NULL UNIQUE,
    item_name TEXT NOT NULL,
    category TEXT,
    manufacturer TEXT,
    supplier TEXT,
    unit TEXT NOT NULL DEFAULT 'pieces',
    current_stock INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER NOT NULL DEFAULT 5,
    maximum_stock INTEGER NOT NULL DEFAULT 100,
    location TEXT NOT NULL DEFAULT 'Central Store',
    rack TEXT,
    purchase_price REAL NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE,
    department TEXT,
    location TEXT,
    reported_by TEXT,
    created_by TEXT,
    created_by_role TEXT,
    service_team TEXT NOT NULL DEFAULT 'Biomedical'
        CHECK (service_team IN ('Biomedical', 'Electrical', 'IT')),
    equipment_identifier TEXT,
    equipment_name TEXT,
    make_model TEXT,
    priority TEXT,
    problem_category TEXT,
    failure_description TEXT,
    status TEXT DEFAULT 'Open',
    assigned_to_username TEXT,
    assigned_to_name TEXT,
    call_received_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    engineer_start_datetime TIMESTAMP,
    fixed_datetime TIMESTAMP,
    calculated_downtime_hours REAL DEFAULT 0,
    manual_downtime_hours REAL,
    final_downtime_hours REAL DEFAULT 0,
    engineer_notes TEXT DEFAULT '',
    work_done TEXT DEFAULT '',
    spare_parts TEXT DEFAULT '',
    stock_deducted BOOLEAN NOT NULL DEFAULT 0,
    parts_reserved BOOLEAN NOT NULL DEFAULT 0,
    parts_cost REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS request_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    file_data BLOB,
    content_type TEXT NOT NULL,
    original_size_bytes INTEGER NOT NULL DEFAULT 0,
    stored_size_bytes INTEGER NOT NULL DEFAULT 0,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vendor_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_team TEXT NOT NULL DEFAULT 'Biomedical'
        CHECK (service_team IN ('Biomedical', 'Electrical', 'IT')),
    vendor_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    contract_type TEXT NOT NULL DEFAULT 'AMC',
    contract_number TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    response_sla_hours INTEGER NOT NULL DEFAULT 24,
    coverage TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_service_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    service_date DATE NOT NULL,
    reference_number TEXT,
    technician_name TEXT,
    summary TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES vendor_contracts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ward_boy_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('Pickup', 'Return')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Completed')),
    source_location TEXT NOT NULL,
    destination_location TEXT NOT NULL,
    notes TEXT DEFAULT '',
    requested_by_username TEXT NOT NULL,
    requested_by_name TEXT NOT NULL,
    requested_by_role TEXT NOT NULL,
    assigned_to_username TEXT,
    assigned_to_name TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE (request_id, movement_type),
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS spare_part_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT NOT NULL UNIQUE,
    requested_by_username TEXT NOT NULL,
    requested_by_name TEXT NOT NULL,
    requested_by_role TEXT NOT NULL,
    service_team TEXT NOT NULL CHECK (service_team IN ('Biomedical', 'Electrical', 'IT')),
    request_type TEXT NOT NULL CHECK (request_type IN ('Internal', 'External')),
    central_store_item_id INTEGER,
    requested_item_name TEXT NOT NULL,
    requested_item_code TEXT,
    category TEXT,
    manufacturer TEXT,
    specification TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'pieces',
    request_reason TEXT NOT NULL DEFAULT 'General',
    priority TEXT NOT NULL DEFAULT 'Medium',
    linked_request_id INTEGER,
    delivery_location TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Submitted',
    central_store_notes TEXT NOT NULL DEFAULT '',
    approved_by_username TEXT,
    approved_by_name TEXT,
    stock_issued BOOLEAN NOT NULL DEFAULT 0,
    fulfilled_quantity INTEGER NOT NULL DEFAULT 0,
    delivery_mode TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    ready_at TIMESTAMP,
    dispatched_at TIMESTAMP,
    ward_boy_completed_at TIMESTAMP,
    engineer_confirmed_at TIMESTAMP,
    completed_at TIMESTAMP,
    rejected_at TIMESTAMP,
    FOREIGN KEY (central_store_item_id) REFERENCES central_store_items(id) ON DELETE SET NULL,
    FOREIGN KEY (linked_request_id) REFERENCES requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS store_delivery_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spare_request_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'Pending',
    source_location TEXT NOT NULL DEFAULT 'Central Store',
    destination_location TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    requested_by_username TEXT NOT NULL,
    requested_by_name TEXT NOT NULL,
    assigned_to_username TEXT,
    assigned_to_name TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (spare_request_id) REFERENCES spare_part_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pm_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    department TEXT,
    location TEXT,
    engineer_id INTEGER,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    frequency_days INTEGER NOT NULL,
    status TEXT DEFAULT 'Upcoming',
    department_response TEXT NOT NULL DEFAULT 'Pending',
    department_response_note TEXT,
    department_response_at TIMESTAMP,
    checklist_completed BOOLEAN DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS pm_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    pm_schedule_id INTEGER NOT NULL,
    engineer_id INTEGER,
    engineer_name TEXT,
    scheduled_date DATE,
    completed_date DATE,
    checklist_status TEXT DEFAULT 'Completed',
    maintenance_duration REAL DEFAULT 0,
    remarks TEXT,
    spare_parts_used TEXT,
    total_parts_cost REAL DEFAULT 0,
    status_before TEXT,
    status_after TEXT DEFAULT 'Completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (pm_schedule_id) REFERENCES pm_schedules(id)
);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    yearly_index INTEGER,
    token_number INTEGER UNIQUE,
    month TEXT,
    call_received_date TEXT,
    call_received_time TEXT,
    department_location TEXT,
    attended_person TEXT,
    asset_id TEXT,
    equipment_name TEXT,
    problem_category TEXT,
    contract_type TEXT,
    make_service_provider_model TEXT,
    failure_description TEXT,
    responded_date TEXT,
    responded_time TEXT,
    solution_description TEXT,
    rectification_date TEXT,
    rectification_time TEXT,
    machine_downtime TEXT,
    call_status TEXT,
    created_by TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by TEXT NOT NULL,
    report_format TEXT NOT NULL,
    frequency TEXT NOT NULL,
    filters_json TEXT NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT 1,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Hospital-wide',
    category TEXT NOT NULL,
    allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (fiscal_year, department, category)
);

CREATE TABLE IF NOT EXISTS purchase_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT NOT NULL UNIQUE,
    budget_id INTEGER,
    department TEXT NOT NULL,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    specification TEXT NOT NULL DEFAULT '',
    vendor_name TEXT NOT NULL DEFAULT '',
    quantity NUMERIC(18,3) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'units',
    unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    justification TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Submitted',
    requested_by_username TEXT NOT NULL,
    requested_by_name TEXT NOT NULL,
    approved_by_username TEXT,
    approved_by_name TEXT,
    approval_note TEXT NOT NULL DEFAULT '',
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    ordered_at TIMESTAMP,
    received_at TIMESTAMP,
    paid_at TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES business_budgets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS business_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_number TEXT NOT NULL UNIQUE,
    budget_id INTEGER,
    transaction_type TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Hospital-wide',
    counterparty TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    payment_method TEXT NOT NULL DEFAULT '',
    invoice_number TEXT NOT NULL DEFAULT '',
    source_type TEXT,
    source_id INTEGER,
    created_by TEXT NOT NULL,
    approved_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_type, source_id),
    FOREIGN KEY (budget_id) REFERENCES business_budgets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS insurance_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_name TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    policy_code TEXT NOT NULL UNIQUE,
    payer_type TEXT NOT NULL,
    coverage_model TEXT NOT NULL DEFAULT 'Cashless',
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    claim_submission_days INTEGER NOT NULL DEFAULT 30,
    payment_due_days INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'Active',
    contact_person TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance_claim_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_reference TEXT NOT NULL UNIQUE,
    policy_id INTEGER NOT NULL,
    service_period_start DATE NOT NULL,
    service_period_end DATE NOT NULL,
    claim_count INTEGER NOT NULL DEFAULT 0,
    claimed_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    approved_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    received_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    deductions_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Draft',
    submitted_at TIMESTAMP,
    expected_payment_date DATE,
    received_at TIMESTAMP,
    query_reason TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (policy_id) REFERENCES insurance_policies(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS business_vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_code TEXT NOT NULL UNIQUE,
    vendor_name TEXT NOT NULL,
    supplier_type TEXT NOT NULL DEFAULT 'General',
    tax_identifier TEXT NOT NULL DEFAULT '',
    contact_person TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    bank_name TEXT NOT NULL DEFAULT '',
    bank_account_reference TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active',
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    vendor_id INTEGER NOT NULL,
    quote_number TEXT NOT NULL,
    quote_date DATE NOT NULL,
    valid_until DATE,
    quantity NUMERIC(18,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
    installation_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    installation_details TEXT NOT NULL DEFAULT '',
    training_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    training_details TEXT NOT NULL DEFAULT '',
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    freight_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    delivery_days INTEGER NOT NULL DEFAULT 0,
    warranty_months INTEGER NOT NULL DEFAULT 0,
    payment_terms TEXT NOT NULL DEFAULT '',
    amc_annual_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    amc_years INTEGER NOT NULL DEFAULT 0,
    amc_terms TEXT NOT NULL DEFAULT '',
    training_included BOOLEAN NOT NULL DEFAULT 0,
    additional_conditions TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Received',
    created_by TEXT NOT NULL,
    selected_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    selected_at TIMESTAMP,
    UNIQUE (vendor_id, quote_number),
    FOREIGN KEY (purchase_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES business_vendors(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS supplier_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    vendor_id INTEGER NOT NULL,
    quotation_id INTEGER,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    approved_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Submitted',
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    approved_by TEXT,
    approval_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (vendor_id, invoice_number),
    FOREIGN KEY (purchase_id) REFERENCES purchase_requests(id) ON DELETE RESTRICT,
    FOREIGN KEY (vendor_id) REFERENCES business_vendors(id) ON DELETE RESTRICT,
    FOREIGN KEY (quotation_id) REFERENCES supplier_quotations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    reference_number TEXT NOT NULL UNIQUE,
    amount NUMERIC(18,2) NOT NULL,
    requested_payment_date DATE NOT NULL,
    paid_date DATE,
    payment_method TEXT NOT NULL DEFAULT '',
    bank_reference TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending Approval',
    request_note TEXT NOT NULL DEFAULT '',
    approval_note TEXT NOT NULL DEFAULT '',
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    completed_by TEXT,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS business_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    original_size_bytes INTEGER NOT NULL DEFAULT 0,
    stored_size_bytes INTEGER NOT NULL DEFAULT 0,
    file_data BLOB NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_code TEXT NOT NULL UNIQUE,
    legal_name TEXT NOT NULL,
    base_currency TEXT NOT NULL DEFAULT 'INR',
    country TEXT NOT NULL DEFAULT 'India',
    state_code TEXT NOT NULL,
    gstin TEXT NOT NULL DEFAULT '',
    fiscal_year_start DATE NOT NULL,
    fiscal_year_end DATE NOT NULL,
    books_start_date DATE NOT NULL,
    lock_date DATE,
    status TEXT NOT NULL DEFAULT 'Active',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    parent_id INTEGER,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    normal_balance TEXT NOT NULL,
    system_key TEXT,
    is_group BOOLEAN NOT NULL DEFAULT 0,
    allow_direct_posting BOOLEAN NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Active',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, account_code),
    UNIQUE (company_id, system_key),
    FOREIGN KEY (company_id) REFERENCES finance_companies(id) ON DELETE RESTRICT,
    FOREIGN KEY (parent_id) REFERENCES finance_accounts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_cost_centers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    cost_center_code TEXT NOT NULL,
    cost_center_name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Hospital-wide',
    status TEXT NOT NULL DEFAULT 'Active',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, cost_center_code),
    FOREIGN KEY (company_id) REFERENCES finance_companies(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_tax_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    template_code TEXT NOT NULL,
    template_name TEXT NOT NULL,
    gst_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
    cess_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
    hsn_sac TEXT NOT NULL DEFAULT '',
    supply_type TEXT NOT NULL DEFAULT 'Goods',
    input_credit_eligible BOOLEAN NOT NULL DEFAULT 1,
    reverse_charge BOOLEAN NOT NULL DEFAULT 0,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status TEXT NOT NULL DEFAULT 'Active',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, template_code),
    FOREIGN KEY (company_id) REFERENCES finance_companies(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    reference_number TEXT NOT NULL UNIQUE,
    entry_date DATE NOT NULL,
    entry_type TEXT NOT NULL DEFAULT 'Journal',
    narration TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    source_type TEXT,
    source_id INTEGER,
    reversal_of_id INTEGER,
    review_note TEXT NOT NULL DEFAULT '',
    total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    approved_by TEXT,
    submitted_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    UNIQUE (source_type, source_id),
    FOREIGN KEY (company_id) REFERENCES finance_companies(id) ON DELETE RESTRICT,
    FOREIGN KEY (reversal_of_id) REFERENCES finance_journal_entries(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_journal_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL,
    line_number INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    cost_center_id INTEGER,
    description TEXT NOT NULL DEFAULT '',
    party_type TEXT NOT NULL DEFAULT '',
    party_reference TEXT NOT NULL DEFAULT '',
    debit NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_component TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (journal_entry_id) REFERENCES finance_journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (cost_center_id) REFERENCES finance_cost_centers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_assets_service_team ON assets(service_team);
CREATE INDEX IF NOT EXISTS ix_asset_relocation_requests_asset_id ON asset_relocation_requests(asset_id);
CREATE INDEX IF NOT EXISTS ix_asset_relocation_requests_status ON asset_relocation_requests(status);
CREATE INDEX IF NOT EXISTS ix_inventory_service_team ON inventory(service_team);
CREATE INDEX IF NOT EXISTS ix_requests_created_by ON requests(created_by);
CREATE INDEX IF NOT EXISTS ix_requests_service_team ON requests(service_team);
CREATE INDEX IF NOT EXISTS ix_requests_assigned_to_username ON requests(assigned_to_username);
CREATE INDEX IF NOT EXISTS ix_request_attachments_request_id ON request_attachments(request_id);
CREATE INDEX IF NOT EXISTS ix_vendor_contracts_service_team ON vendor_contracts(service_team);
CREATE INDEX IF NOT EXISTS ix_vendor_contracts_end_date ON vendor_contracts(end_date);
CREATE INDEX IF NOT EXISTS ix_vendor_service_history_contract_id ON vendor_service_history(contract_id);
CREATE INDEX IF NOT EXISTS ix_ward_boy_tasks_request_id ON ward_boy_tasks(request_id);
CREATE INDEX IF NOT EXISTS ix_ward_boy_tasks_status ON ward_boy_tasks(status);
CREATE INDEX IF NOT EXISTS ix_pm_schedules_asset_id ON pm_schedules(asset_id);
CREATE INDEX IF NOT EXISTS ix_business_budgets_fiscal_year ON business_budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS ix_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS ix_purchase_requests_budget_id ON purchase_requests(budget_id);
CREATE INDEX IF NOT EXISTS ix_business_transactions_transaction_date ON business_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS ix_business_transactions_budget_id ON business_transactions(budget_id);
CREATE INDEX IF NOT EXISTS ix_insurance_policies_status ON insurance_policies(status);
CREATE INDEX IF NOT EXISTS ix_insurance_claim_batches_status ON insurance_claim_batches(status);
CREATE INDEX IF NOT EXISTS ix_business_vendors_status ON business_vendors(status);
CREATE INDEX IF NOT EXISTS ix_supplier_quotations_purchase_id ON supplier_quotations(purchase_id);
CREATE INDEX IF NOT EXISTS ix_supplier_invoices_vendor_id ON supplier_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS ix_supplier_invoices_due_date ON supplier_invoices(due_date);
CREATE INDEX IF NOT EXISTS ix_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS ix_supplier_payments_invoice_id ON supplier_payments(invoice_id);
CREATE INDEX IF NOT EXISTS ix_supplier_payments_status ON supplier_payments(status);
CREATE INDEX IF NOT EXISTS ix_business_documents_record ON business_documents(record_type, record_id);

