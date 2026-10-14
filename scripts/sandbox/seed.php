<?php
if (PHP_SAPI !== 'cli' || getenv('IPAWCUS_SANDBOX') !== '1') { exit(1); }
require_once __DIR__ . '/../../php/db.php';
if (getenv('DB_NAME') !== 'ipawcus_sandbox' || getenv('DB_PORT') !== '33308') {
    throw new RuntimeException('Refusing to seed outside the dedicated sandbox.');
}
$password = getenv('IPAWCUS_SANDBOX_LOGIN_PASSWORD');
if (!$password) throw new RuntimeException('Sandbox fixture password is missing.');
$pdo->beginTransaction();
try {
    $pdo->exec("INSERT INTO branches (branch_id,branch_code,branch_name,branch_type,address,is_main) VALUES
        (1,'MAIN','Sandbox Main Clinic','main_clinic','Synthetic Main Street',1),
        (2,'ENRIQUEZ','Sandbox Second Clinic','pet_corner','Synthetic Second Street',0)");
    $accounts = [
        [1,'owner','pet_owner',1], [2,'other-owner','pet_owner',2],
        [3,'admin','Admin',1], [4,'other-admin','Admin',2],
        [5,'vet','Veterinarian',1], [6,'other-vet','Veterinarian',2],
        [7,'superadmin','Super Admin',1],
    ];
    $user = $pdo->prepare('INSERT INTO users (user_id,first_Name,last_Name,mail_Address,email_verified_at,personal_Address,user_password,phoneNumber,role,preferred_branch_id) VALUES (?,?,?,?,NOW(),?,?,?,?,?)');
    $assignment = $pdo->prepare('INSERT INTO user_branch_assignments (user_id,branch_id,is_primary,is_active) VALUES (?,?,1,1)');
    foreach ($accounts as [$id,$name,$role,$branch]) {
        $user->execute([$id,'Sandbox',ucwords(str_replace('-',' ',$name)), $name . '@sandbox.invalid','Synthetic address',password_hash($password,PASSWORD_DEFAULT),'09123456789',$role,$branch]);
        $assignment->execute([$id,$branch]);
        if (in_array($id,[3,4,7],true)) {
            $stmt = $pdo->prepare("INSERT INTO admin_profiles (user_id,employee_id,postionn,is_active) VALUES (?,?,'Reception',1)");
            $stmt->execute([$id,'SANDBOX-' . $id]);
        }
        if (in_array($id,[5,6],true)) {
            $stmt = $pdo->prepare("INSERT INTO veterinarian_profiles (user_id,veterinarian_id,prc_license_number,specialization,consultation_rate,is_active,is_accepting_patients) VALUES (?,?,?,'Sandbox General Practice',500,1,1)");
            $stmt->execute([$id,'SB-VET-' . $id,'TEST-' . $id]);
        }
    }
    for ($branch=1; $branch<=2; $branch++) {
        for ($day=1; $day<=7; $day++) {
            $stmt=$pdo->prepare("INSERT INTO branch_operating_hours (branch_id,day_of_week,opens_at,closes_at,is_closed) VALUES (?,?,'08:00:00','18:00:00',?)");
            $stmt->execute([$branch,$day,$day===7?1:0]);
        }
        foreach (['general-checkup','vaccination','grooming','boarding','online-consultation'] as $service) {
            $stmt=$pdo->prepare("INSERT INTO branch_service_availability (branch_id,service_key,service_label,availability_mode,booking_enabled,queue_enabled,is_active) VALUES (?,?,?,'always',1,1,1)");
            $stmt->execute([$branch,$service,ucwords(str_replace('-',' ',$service))]);
        }
        $stmt=$pdo->prepare("INSERT INTO inventory_locations (branch_id,location_name,location_type,address,status) VALUES (?,?,'branch','Synthetic address','active')");
        $stmt->execute([$branch,'Sandbox Stock ' . $branch]);
    }
    $pdo->exec("INSERT INTO pets_information (pet_id,pet_name,pet_species,pet_breed,pet_BDAY,pet_gender,pet_weight,pet_sharable_ID) VALUES
        (1,'Sandbox Mochi','Dog','Mixed','2023-01-01','Female',10,'SANDBOX-MOCHI'),
        (2,'Sandbox Miso','Cat','Mixed','2023-01-01','Male',4,'SANDBOX-MISO')");
    $pdo->exec("INSERT INTO pet_ownership (user_id,pet_id,relationship,is_primary) VALUES (1,1,'primary',1),(2,2,'primary',1)");
    $pdo->exec("INSERT INTO service_catalog (service_code,service_name,service_type,base_price,is_active) VALUES
        ('SB-CONSULT','Sandbox Consultation','consultation',500,1),
        ('SB-GROOM','Sandbox Bath','grooming',350,1),
        ('SB-BOARD','Sandbox Hotel Stay','boarding',300,1)");
    $pdo->commit();
    echo "Seeded seven synthetic accounts, two branches, two pets and service fixtures.\n";
} catch (Throwable $error) {
    $pdo->rollBack();
    throw $error;
}
