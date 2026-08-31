<?php

const IPAWCUS_PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';

function ipawcus_password_meets_policy(string $password): bool
{
    return strlen($password) >= 8
        && preg_match('/[A-Z]/', $password) === 1
        && preg_match('/[0-9]/', $password) === 1
        && preg_match('/[^A-Za-z0-9\s]/', $password) === 1;
}

function ipawcus_password_policy_error(): string
{
    return IPAWCUS_PASSWORD_POLICY_MESSAGE;
}
