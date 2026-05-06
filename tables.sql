-- auto-generated definition
create table bookings
(
    booking_id                 int auto_increment
        primary key,
    user_id                    int                                                                                                                                              not null,
    pet_id                     int                                                                                                                                              not null,
    booking_number             varchar(20)                                                                                                                                      not null,
    service_type               enum ('consultation', 'vaccination', 'grooming', 'dental', 'wellness', 'surgery', 'lab-testing', 'parasite-control', 'boarding', 'home-service') not null,
    booking_date               date                                                                                                                                             not null,
    booking_time               time                                                                                                                                             not null,
    status                     enum ('pending', 'confirmed', 'completed', 'cancelled') default 'pending'                                                                        null,
    price                      decimal(10, 2)                                                                                                                                   null,
    notes                      text                                                                                                                                             null,
    is_home_service            tinyint(1)                                              default 0                                                                                null,
    address                    text                                                                                                                                             null,
    payment_proof_url          varchar(255)                                                                                                                                     null,
    is_online_consultation     tinyint(1)                                              default 0                                                                                null,
    veterinarian_id            varchar(50)                                                                                                                                      null,
    created_at                 timestamp                                               default current_timestamp()                                                              not null,
    Image_Booking_Concern_Path text                                                                                                                                             null,
    registered_status          enum ('Registered', 'Not Registered')                                                                                                            null,
    petType                    varchar(250)                                                                                                                                     null,
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
    file_url    varchar(255)                          not null,
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

