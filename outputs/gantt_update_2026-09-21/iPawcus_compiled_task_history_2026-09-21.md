# iPawcus Compiled Task History

**Coverage:** January 1, 2026 to September 21, 2026  
**As-of date:** September 21, 2026  
**Source files:** `saving one gantt.xlsx` and `gantt-chart-template.xlsx`

## Cycle rule

A **cycle is used only when the same task has more than one separate start and end period**, such as a rework, revision, retest, or repeated task.

- A task with one start date has one `Start` and `End` entry. It is not labeled as a cycle.
- A repeated task has `Cycle 1`, `Cycle 2`, and, when needed, `Cycle 3`.
- An iteration number is not a cycle number.
- The historical files did not include verified owners or statuses. These fields remain `Unassigned` and `Not documented`.
- Dates marked **Approximate** were reconstructed from the task bar's position because the source only identified a month.
- The apparent `2031`, `2032`, and `2033` dates in the old file were treated as placeholders and were not used.

## Chronological date index

| Iteration | Task | Occurrence | Start | End / Due | Date basis |
|---|---|---|---|---|---|
| Preparation | Interview with Vetfocus Clinic and initial system-module identification | Single period | Jan 1, 2026 | Mar 31, 2026 | Month range from source |
| Iteration 1 | Identify system modules | Cycle 1 | Apr 1, 2026 | Apr 10, 2026 | Exact |
| Iteration 1 | Design user access | Single period | Apr 16, 2026 | Apr 23, 2026 | Approximate |
| Iteration 1 | Landing page development | Single period | Apr 24, 2026 | Apr 30, 2026 | Approximate |
| Iteration 1 | Register and login page | Single period | Apr 28, 2026 | May 3, 2026 | Approximate |
| Iteration 1 | User registration | Single period | May 2, 2026 | May 9, 2026 | Approximate |
| Iteration 1 | Admin and veterinarian account creation page | Single period | May 7, 2026 | May 15, 2026 | Approximate |
| Iteration 1 | Testing | Cycle 1 | May 10, 2026 | May 12, 2026 | Approximate |
| Iteration 2 | Identify system modules | Cycle 2 | May 18, 2026 | May 23, 2026 | Approximate |
| Iteration 2 | Design role management | Single period | May 20, 2026 | May 27, 2026 | Approximate |
| Iteration 2 | User profiles | Single period | May 25, 2026 | May 31, 2026 | Approximate |
| Iteration 2 | Accounts management module | Single period | May 29, 2026 | Jun 8, 2026 | Approximate |
| Iteration 2 | Role-based logic control | Single period | Jun 4, 2026 | Jun 14, 2026 | Approximate |
| Iteration 2 | Clinic account monitoring module | Single period | Jun 9, 2026 | Jun 14, 2026 | Approximate |
| Iteration 2 | Testing | Cycle 2 | Jun 9, 2026 | Jun 11, 2026 | Approximate |

## Preparation

### Task 1 - Interview with Vetfocus Clinic and initial system-module identification | Status: Not documented | Owner: Unassigned | Due: Mar 31, 2026

- Start: Jan 1, 2026
- End: Mar 31, 2026
- Date basis: Month range from source

## Iteration 1

### Task 1 - Identify system modules | Status: Not documented | Owner: Unassigned | Due: May 23, 2026

This task has two separate working periods, so cycles are used.

- Cycle 1 | Start: Apr 1, 2026 | End: Apr 10, 2026 | Iteration: 1 | Date basis: Exact
- Cycle 2 | Start: May 18, 2026 | End: May 23, 2026 | Iteration: 2 | Date basis: Approximate

### Task 2 - Design user access | Status: Not documented | Owner: Unassigned | Due: Apr 23, 2026

- Start: Apr 16, 2026
- End: Apr 23, 2026
- Date basis: Approximate

### Task 3 - Landing page development | Status: Not documented | Owner: Unassigned | Due: Apr 30, 2026

- Start: Apr 24, 2026
- End: Apr 30, 2026
- Date basis: Approximate

### Task 4 - Register and login page | Status: Not documented | Owner: Unassigned | Due: May 3, 2026

- Start: Apr 28, 2026
- End: May 3, 2026
- Date basis: Approximate

### Task 5 - User registration | Status: Not documented | Owner: Unassigned | Due: May 9, 2026

- Start: May 2, 2026
- End: May 9, 2026
- Date basis: Approximate

### Task 6 - Admin and veterinarian account creation page | Status: Not documented | Owner: Unassigned | Due: May 15, 2026

- Start: May 7, 2026
- End: May 15, 2026
- Date basis: Approximate

### Task 7 - Testing | Status: Not documented | Owner: Unassigned | Due: Jun 11, 2026

This task has two separate testing periods, so cycles are used.

- Cycle 1 | Start: May 10, 2026 | End: May 12, 2026 | Iteration: 1 | Date basis: Approximate
- Cycle 2 | Start: Jun 9, 2026 | End: Jun 11, 2026 | Iteration: 2 | Date basis: Approximate

## Iteration 2

The repeated `Identify system modules` and `Testing` periods are recorded as later cycles under their original task entries in Iteration 1. They are not duplicated below.

### Task 1 - Design role management | Status: Not documented | Owner: Unassigned | Due: May 27, 2026

- Start: May 20, 2026
- End: May 27, 2026
- Date basis: Approximate

### Task 2 - User profiles | Status: Not documented | Owner: Unassigned | Due: May 31, 2026

- Start: May 25, 2026
- End: May 31, 2026
- Date basis: Approximate

### Task 3 - Accounts management module | Status: Not documented | Owner: Unassigned | Due: Jun 8, 2026

- Start: May 29, 2026
- End: Jun 8, 2026
- Date basis: Approximate

### Task 4 - Role-based logic control | Status: Not documented | Owner: Unassigned | Due: Jun 14, 2026

- Start: Jun 4, 2026
- End: Jun 14, 2026
- Date basis: Approximate

### Task 5 - Clinic account monitoring module | Status: Not documented | Owner: Unassigned | Due: Jun 14, 2026

- Start: Jun 9, 2026
- End: Jun 14, 2026
- Date basis: Approximate

## Unrecorded period

### July 1, 2026 to September 21, 2026

No task names, additional cycles, owners, statuses, or dates for this period were found in the two source workbooks.

## Reusable fill-in format

### Task with one working period

```text
Iteration [Number]
  Task 1 - [Task Name] | Status: [Working on it / Done / Stuck / Not Started] | Owner: [Name] | Due: [End date]
    Start: [Month Day, Year]
    End: [Month Day, Year]
```

### Task with rework or multiple working periods

```text
Iteration [Number]
  Task 1 - [Task Name] | Status: [Working on it / Done / Stuck / Not Started] | Owner: [Name] | Due: [Final cycle end date]
    Cycle 1 | Start: [Month Day, Year] | End: [Month Day, Year]
    Cycle 2 | Start: [Month Day, Year] | End: [Month Day, Year]
    Cycle 3 | Start: [Month Day, Year] | End: [Month Day, Year]
```

