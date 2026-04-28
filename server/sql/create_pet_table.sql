create table if not exists pets_information (
    pet_id int primary key auto_increment,
    pet_name varchar(250) not null,
    pet_species varchar(100) not null,
    pet_breed varchar(250) not null,
    pet_BDAY date not null,
    pet_status enum('Healthy', 'Emergency', 'Deceased') not null default 'Healthy',
    pet_age varchar(250),
    pet_gender varchar(250) not null,
    pet_weight decimal(8,2) not null,
    pet_microchip int null,
    pet_Temp_owner varchar(250) null,
    pet_allergies varchar(250) null,
    pet_color_marking varchar(250) null,
    pet_sharable_ID VARCHAR(250) unique

);
create table history_before_registration(
  current_medication varchar(250),
    veterinarian_notes varchar(250),
    pet_id int,
    last_visit_Date date,
    foreign key (pet_id) references  pets_information(pet_id)
);
CREATE TABLE if not exists Pet_Ownership (
                               link_id INT AUTO_INCREMENT PRIMARY KEY,
                               user_id INT,
                               pet_id INT,
                               linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

                               FOREIGN KEY (user_id) REFERENCES users(user_id),
                               FOREIGN KEY (pet_id) REFERENCES pets_information(pet_id)
);


# alter table pets_information
# add column  age varchar (250);
#
# select * from pets_information;
# SELECT * FROM Pet_Ownership;
#
#
#
# DELETE FROM Pet_Ownership
# WHERE link_id = 5;
#
#  ALTER TABLE Pet_Ownership ADD UNIQUE (pet_id);