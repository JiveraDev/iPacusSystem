-- New table for veterinarian schedules
CREATE TABLE vet_schedules (
    schedule_id int auto_increment primary key,
    user_id int not null,
    day_of_week varchar(20) not null,
    time_slot varchar(20) not null,
    is_available tinyint(1) default 1,
    unique key unique_vet_schedule_slot (user_id, day_of_week, time_slot),
    constraint vet_schedules_fk
        foreign key (user_id) references users (user_id)
            on delete cascade
);
