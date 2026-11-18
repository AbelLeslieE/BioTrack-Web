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
    role TEXT NOT NULL CHECK (role IN ('Manager', 'BME', 'Electrical', 'IT', 'User', 'WardBoy')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    bpk_number TEXT NOT NULL UNIQUE,
    item_name TEXT NOT NULL,
    category TEXT,
    manufacturer TEXT,
    supplier TEXT,
    unit TEXT,
    current_stock INTEGER DEFAULT 0,
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
    call_received_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    engineer_start_datetime TIMESTAMP,
    fixed_datetime TIMESTAMP,
    calculated_downtime_hours REAL DEFAULT 0,
    manual_downtime_hours REAL,
    final_downtime_hours REAL DEFAULT 0,
    engineer_notes TEXT DEFAULT '',
    work_done TEXT DEFAULT '',
    spare_parts TEXT DEFAULT '',
    stock_deducted BOOLEAN NOT NULL DEFAULT 0
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

CREATE INDEX IF NOT EXISTS ix_assets_service_team ON assets(service_team);
CREATE INDEX IF NOT EXISTS ix_inventory_service_team ON inventory(service_team);
CREATE INDEX IF NOT EXISTS ix_requests_created_by ON requests(created_by);
CREATE INDEX IF NOT EXISTS ix_requests_service_team ON requests(service_team);
CREATE INDEX IF NOT EXISTS ix_ward_boy_tasks_request_id ON ward_boy_tasks(request_id);
CREATE INDEX IF NOT EXISTS ix_ward_boy_tasks_status ON ward_boy_tasks(status);
CREATE INDEX IF NOT EXISTS ix_pm_schedules_asset_id ON pm_schedules(asset_id);

