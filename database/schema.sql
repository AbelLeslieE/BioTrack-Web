-- ==========================================
-- BioTrack Database Schema
-- Version 1.0
-- ==========================================

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    department TEXT NOT NULL,

    role TEXT NOT NULL
        CHECK(role IN ('admin', 'engineer', 'user')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- LOGS TABLE
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    yearly_index INTEGER NOT NULL,

    token_number INTEGER NOT NULL UNIQUE,

    month TEXT NOT NULL,

    call_received_date TEXT,
    call_received_time TEXT,

    department_location TEXT,
    attended_person TEXT,

    asset_id TEXT,
    equipment_name TEXT,

    problem_category TEXT
        CHECK(problem_category IN ('Major','Minor')),

    contract_type TEXT
        CHECK(contract_type IN ('Contract','In-House')),

    make_service_provider_model TEXT,

    failure_description TEXT,

    responded_date TEXT,
    responded_time TEXT,

    solution_description TEXT,

    rectification_date TEXT,
    rectification_time TEXT,

    machine_downtime TEXT,

    call_status TEXT
        CHECK(call_status IN ('Open','Closed')),

    created_by TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

