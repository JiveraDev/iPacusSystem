-- auto-generated definition
create table bookings
(
    booking_id                 int auto_increment
        primary key,
    user_id                    int                                                                                                                                                                           not null,
    pet_id                     int                                                                                                                                                                           null,
    booking_number             varchar(20)                                                                                                                                                                   not null,
    service_type               enum ('consultation', 'vaccination', 'grooming', 'dental', 'wellness', 'surgery', 'kapon', 'lab-testing', 'parasite-control', 'boarding', 'home-service', 'special services') not null,
    booking_date               date                                                                                                                                                                          not null,
    booking_time               time                                                                                                                                                                          not null,
    status                     enum ('pending', 'confirmed', 'completed', 'cancelled') default 'pending'                                                                                                     null,
    price                      decimal(10, 2)                                                                                                                                                                null,
    notes                      text                                                                                                                                                                          null,
    is_home_service            tinyint(1)                                              default 0                                                                                                             null,
    address                    text                                                                                                                                                                          null,
    payment_proof_url          varchar(255)                                                                                                                                                                  null,
    is_online_consultation     tinyint(1)                                              default 0                                                                                                             null,
    veterinarian_id            varchar(50)                                                                                                                                                                   null,
    created_at                 timestamp                                               default current_timestamp()                                                                                           not null,
    Image_Booking_Concern_Path text                                                                                                                                                                          null,
    registered_status          enum ('Registered', 'Not Registered')                                                                                                                                         null,
    petType                    varchar(250)                                                                                                                                                                  null,
    unregistered_pet_name      varchar(250)                                                                                                                                                                  null,
    unregistered_pet_breed     varchar(250)                                                                                                                                                                  null,
    unregistered_pet_age       varchar(250)                                                                                                                                                                  null,
    unregistered_pet_weight    varchar(250)                                                                                                                                                                  null,
    constraint booking_number
        unique (booking_number),
    constraint bookings_ibfk_1
        foreign key (user_id) references users (user_id),
    constraint bookings_ibfk_2
        foreign key (pet_id) references pets_information (pet_id)
);

create index pet_id
    on bookings (pet_id);

create index user_id
    on bookings (user_id);



#llllllllllllllllllllllllllllll
-- auto-generated definition
create table consent_files
(
    file_id     int auto_increment
        primary key,
    file_name   varchar(255)                          not null,
    file_type   varchar(10)                           not null,
    file_size   varchar(20)                           null,
    content     longtext                              null,
    category    varchar(50)                           null,
    uploaded_at timestamp default current_timestamp() not null
);


#  llllllllllllllllllll
-- auto-generated definition
create table history_before_registration
(
    current_medication varchar(250) null,
    veterinarian_notes varchar(250) null,
    pet_id             int          null,
    last_visit_Date    date         null,
    constraint history_before_registration_ibfk_1
        foreign key (pet_id) references pets_information (pet_id)
);

create index pet_id
    on history_before_registration (pet_id);

# llllllllllllllllllllllllllllllllllllll
-- auto-generated definition
create table pet_ownership
(
    link_id   int auto_increment
        primary key,
    user_id   int                                   null,
    pet_id    int                                   null,
    linked_at timestamp default current_timestamp() not null,
    constraint pet_id
        unique (pet_id),
    constraint pet_ownership_ibfk_1
        foreign key (user_id) references users (user_id),
    constraint pet_ownership_ibfk_2
        foreign key (pet_id) references pets_information (pet_id)
);

create index user_id
    on pet_ownership (user_id);

# llllllllllllllllllllllllllllllll

-- auto-generated definition
create table pets_information
(
    pet_id            int auto_increment
        primary key,
    pet_name          varchar(250)                                                not null,
    pet_species       varchar(100)                                                not null,
    pet_breed         varchar(250)                                                not null,
    pet_BDAY          date                                                        not null,
    pet_status        enum ('Healthy', 'Emergency', 'Deceased') default 'Healthy' not null,
    pet_gender        varchar(250)                                                not null,
    pet_weight        decimal(8, 2)                                               not null,
    pet_microchip     int                                                         null,
    pet_Temp_owner    varchar(250)                                                null,
    pet_allergies     varchar(250)                                                null,
    pet_color_marking varchar(250)                                                null,
    pet_sharable_ID   varchar(250)                                                null,
    pet_age           varchar(250)                                                null,
    setpetImage_url   varchar(250)                                                null,
    constraint pet_sharable_ID
        unique (pet_sharable_ID)
);

# lllllllllllllllllllll
-- auto-generated definition
create table queues
(
    queue_id     int auto_increment
        primary key,
    pet_id       int                                                                                   not null,
    user_id      int                                                                                   not null,
    service_name varchar(100)                                                                          not null,
    queue_number int                                                                                   not null,
    status       enum ('waiting', 'in-progress', 'completed', 'cancelled') default 'waiting'           null,
    priority     enum ('normal', 'urgent')                                 default 'normal'            null,
    complaint    text                                                                                  null,
    timestamp    datetime                                                  default current_timestamp() null,
    constraint queues_ibfk_1
        foreign key (pet_id) references pets_information (pet_id),
    constraint queues_ibfk_2
        foreign key (user_id) references users (user_id)
);

create index pet_id
    on queues (pet_id);

create index user_id
    on queues (user_id);

# llllllllllllllllllllll
-- auto-generated definition
create table users
(
    user_id           int auto_increment
        primary key,
    first_Name        varchar(100)                          null,
    last_Name         varchar(100)                          not null,
    mail_Address      varchar(200)                          not null,
    personal_Address  varchar(250)                          not null,
    user_password     varchar(250)                          null,
    emergencyNumber   varchar(100)                          null,
    phoneNumber       varchar(100)                          null,
    role              varchar(100)                          null,
    created_at        timestamp default current_timestamp() not null,
    setProfilePic_url varchar(250)                          null,
    birthdate         date                                  null
);

# ???????????????????????????????
-- auto-generated definition

create table admin_profiles
(
    id                int auto_increment
        primary key,
    user_id           int                                         not null,
    employee_id       varchar(50)                                 null,
    hire_date         date                                        null,
    employment_status enum ('full-time', 'part-time', 'contract') null,
    sss_number        varchar(50)                                 null,
    philhealth_number varchar(50)                                 null,
    tin_number        varchar(50)                                 null,
    pagibig_number    varchar(50)                                 null,
    created_at        timestamp default current_timestamp()       not null,
    postionn          varchar(250)                                null,
    is_active         tinyint(1) default 1                        null,
    constraint employee_id
        unique (employee_id),
    constraint admin_profiles_ibfk_1
        foreign key (user_id) references users (user_id)
            on delete cascade
);

create index user_id
    on admin_profiles (user_id);



# ??????????????????????????????

-- auto-generated definition
create table veterinarian_profiles
(
    id                    int auto_increment
        primary key,
    user_id               int                                    not null,
    veterinarian_id       varchar(50)                            null,
    prc_license_number    varchar(50)                            null,
    specialization        text                                   null,
    consultation_rate     decimal(10, 2)                         null,
    years_of_experience   int                                    null,
    hire_date             date                                   null,
    is_accepting_patients tinyint(1) default 1                   null,
    is_active             tinyint(1) default 0                   null,
    created_at            timestamp  default current_timestamp() not null,
    constraint veterinarian_id
        unique (veterinarian_id),
    constraint veterinarian_profiles_ibfk_1
        foreign key (user_id) references users (user_id)
            on delete cascade
);

create index user_id
    on veterinarian_profiles (user_id);









# INVENTORY TABLES --

-- auto-generated definition
create table inventory_batches
(
    batch_id           int auto_increment
        primary key,
    item_id            int                                        not null,
    batch_number       varchar(100)                               not null,
    quantity           int            default 0                   not null,
    manufacturing_date date                                       null,
    expiry_date        date                                       null,
    unit_cost          decimal(10, 2) default 0.00                not null,
    created_at         timestamp      default current_timestamp() not null,
    location_id        int                                        not null,
    constraint item_id
        unique (item_id, batch_number),
    constraint inventory_batches_item_fk
        foreign key (item_id) references inventory_items (item_id)
            on delete cascade,
    constraint inventory_batches_location_fk
        foreign key (location_id) references inventory_locations (location_id)
);

-- auto-generated definition
create table inventory_items
(
    item_id             int auto_increment
        primary key,
    item_name           varchar(150)                                            not null,
    generic_name        varchar(150)                                            null,
    sku                 varchar(80)                                             not null,
    barcode             varchar(100)                                            null,
    description         text                                                    null,
    category            varchar(100)                                            not null,
    brand               varchar(100)                                            null,
    unit                varchar(50)                                             not null,
    reorder_level       int                         default 0                   null,
    unit_cost           decimal(10, 2)              default 0.00                not null,
    expiry_warning_days int                         default 90                  null,
    profile_image_path  varchar(255)                                            null,
    status              enum ('active', 'inactive') default 'active'            null,
    created_by_user_id  int                                                     not null,
    created_by_name     varchar(220)                                            not null,
    created_at          timestamp                   default current_timestamp() not null,
    updated_at          timestamp                   default current_timestamp() not null on update current_timestamp(),
    location_id         int                                                     not null,
    constraint sku
        unique (sku),
    constraint inventory_items_created_by_fk
        foreign key (created_by_user_id) references users (user_id),
    constraint inventory_items_location_fk
        foreign key (location_id) references inventory_locations (location_id)
);

-- auto-generated definition
create table inventory_locations
(
    location_id   int auto_increment
        primary key,
    location_name varchar(150)                                                           not null,
    location_type enum ('branch', 'storage', 'room', 'area') default 'branch'            null,
    address       text                                                                   null,
    status        enum ('active', 'inactive')                default 'active'            null,
    created_at    timestamp                                  default current_timestamp() not null,
    constraint location_name
        unique (location_name)
);

-- auto-generated definition
create table inventory_stock_movements
(
    movement_id          int auto_increment
        primary key,
    item_id              int                                                                  not null,
    batch_id             int                                                                  null,
    movement_type        enum ('add_item', 'stock_in', 'stock_out', 'adjustment', 'disposal') not null,
    quantity_change      int                                                                  not null,
    quantity_before      int       default 0                                                  not null,
    quantity_after       int       default 0                                                  not null,
    reference_type       varchar(50)                                                          null,
    reference_id         int                                                                  null,
    remarks              text                                                                 null,
    performed_by_user_id int                                                                  not null,
    performed_by_name    varchar(220)                                                         not null,
    created_at           timestamp default current_timestamp()                                not null,
    constraint inventory_movements_batch_fk
        foreign key (batch_id) references inventory_batches (batch_id),
    constraint inventory_movements_item_fk
        foreign key (item_id) references inventory_items (item_id),
    constraint inventory_movements_user_fk
        foreign key (performed_by_user_id) references users (user_id)
);

-- auto-generated definition
create table inventory_stock_receipt_items
(
    receipt_item_id   int auto_increment
        primary key,
    receipt_id        int                         not null,
    item_id           int                         not null,
    supplier_id       int                         not null,
    batch_id          int                         null,
    batch_number      varchar(100)                not null,
    quantity_received int                         not null,
    expiry_date       date                        null,
    unit_cost         decimal(10, 2) default 0.00 not null,
    location_id       int                         not null,
    constraint inventory_receipt_items_batch_fk
        foreign key (batch_id) references inventory_batches (batch_id),
    constraint inventory_receipt_items_item_fk
        foreign key (item_id) references inventory_items (item_id),
    constraint inventory_receipt_items_location_fk
        foreign key (location_id) references inventory_locations (location_id),
    constraint inventory_receipt_items_receipt_fk
        foreign key (receipt_id) references inventory_stock_receipts (receipt_id)
            on delete cascade,
    constraint inventory_receipt_items_supplier_fk
        foreign key (supplier_id) references inventory_suppliers (supplier_id)
);

-- auto-generated definition
create table inventory_stock_receipts
(
    receipt_id           int auto_increment
        primary key,
    receiving_date       date                                  not null,
    delivery_note_number varchar(100)                          null,
    proof_image_path     varchar(255)                          null,
    notes                text                                  null,
    received_by_user_id  int                                   not null,
    received_by_name     varchar(220)                          not null,
    created_at           timestamp default current_timestamp() not null,
    constraint inventory_receipts_received_by_fk
        foreign key (received_by_user_id) references users (user_id)
);

-- auto-generated definition
create table inventory_suppliers
(
    supplier_id    int auto_increment
        primary key,
    supplier_name  varchar(150)                                            not null,
    contact_number varchar(100)                                            null,
    email          varchar(150)                                            null,
    address        text                                                    null,
    status         enum ('active', 'inactive') default 'active'            null,
    created_at     timestamp                   default current_timestamp() not null,
    constraint supplier_name
        unique (supplier_name)
);

