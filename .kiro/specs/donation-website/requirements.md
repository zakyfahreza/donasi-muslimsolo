# Requirements Document

## Introduction

The Donation Website is an open crowdfunding system for muslimsolo.id that enables jamaah (congregation members) to discover donation campaigns, donate through Bank Transfer or QRIS, and submit proof of payment for verification. Administrators verify incoming donations, and verified amounts are reflected in each campaign's collected total and progress.

The system is composed of three parts:
- **Frontend**: A static site (HTML/CSS/JS) deployed on GitHub Pages at the domain donasi.muslimsolo.id.
- **Backend API**: A Google Apps Script web app that bridges the frontend and the data store, exposing read endpoints for public data and write endpoints for donation confirmation and admin actions.
- **Data Store**: A Google Spreadsheet containing the `campaigns`, `donations`, `payment`, and `admin` sheets, plus Google Drive for storing uploaded payment proof images.

The design priorities are a fast, mobile-friendly donor experience completed in no more than five steps, accurate computation of collected amounts from verified donations only, and protection of write operations and admin credentials against abuse.

## Glossary

- **System**: The complete donation website solution comprising the Frontend, the Backend_API, and the Data_Store.
- **Frontend**: The static site served from donasi.muslimsolo.id that renders public and admin pages.
- **Backend_API**: The Google Apps Script web app that exposes read and write endpoints and mediates all access to the Data_Store and the Proof_Store.
- **Data_Store**: The Google Spreadsheet containing the `campaigns`, `donations`, `payment`, and `admin` sheets.
- **Proof_Store**: The Google Drive location where uploaded payment proof images are stored and from which shareable links are generated.
- **Landing_Page**: The public page at donasi.muslimsolo.id that lists donation campaigns.
- **Detail_Page**: The public page at /detail?id={id} that shows a single campaign's details.
- **Donation_Page**: The public page at /donasi that captures the donation nominal and shows payment instructions.
- **Confirmation_Form**: The form on which a donor submits donation confirmation details, including payment proof.
- **Admin_Console**: The authenticated admin interface served from admin.html, including the dashboard and verification views.
- **Campaign**: A donation program record stored in the `campaigns` sheet.
- **Donation**: A donor's contribution record stored in the `donations` sheet.
- **Donor**: A member of the public who contributes to a Campaign.
- **Administrator**: An authenticated user who verifies or rejects donations.
- **Campaign_Status**: The lifecycle state of a Campaign, one of ACTIVE, COMPLETED, or CLOSED.
- **Donation_Status**: The verification state of a Donation, one of PENDING, VERIFIED, or REJECTED.
- **Collected_Amount**: The sum of `amount` across all Donations for a Campaign whose Donation_Status is VERIFIED.
- **Progress_Percentage**: Collected_Amount divided by the Campaign target_amount, expressed as a percentage.
- **Write_Token**: A shared secret value required by the Backend_API to authorize write operations.
- **Session_Token**: A time-limited credential issued to an Administrator upon successful login and required for admin write operations.

## Requirements

### Requirement 1: View Active Campaigns on Landing Page

**User Story:** As a Donor, I want to see the list of donation campaigns on the landing page, so that I can choose a campaign to support.

#### Acceptance Criteria

1. WHEN the Landing_Page is requested, THE Backend_API SHALL return the list of Campaigns whose Campaign_Status is ACTIVE.
2. WHEN the Landing_Page renders a Campaign, THE Frontend SHALL display the Campaign title, banner image, target_amount, Collected_Amount, Progress_Percentage, and Campaign_Status.
3. WHEN the Landing_Page renders a Campaign, THE Frontend SHALL display a progress bar representing the Progress_Percentage.
4. WHEN the Landing_Page renders a Campaign, THE Frontend SHALL display a control labeled "Lihat Detail Donasi" that navigates to the Detail_Page for that Campaign.
5. WHEN the Landing_Page renders, THE Frontend SHALL display the MuslimSolo logo.
6. IF no Campaign has Campaign_Status ACTIVE, THEN THE Frontend SHALL display a message stating that no active campaigns are available.
7. IF the Backend_API request fails, THEN THE Frontend SHALL display an error message and a control to retry the request.

### Requirement 2: View Campaign Detail

**User Story:** As a Donor, I want to view the details of a campaign, so that I can understand the need before donating.

#### Acceptance Criteria

1. WHEN the Detail_Page is requested with a campaign id that exists, THE Backend_API SHALL return that Campaign including title, banner image, description, target_amount, Collected_Amount, deadline, and fund usage information.
2. WHEN the Detail_Page renders, THE Frontend SHALL display the Campaign title, banner image, description, target_amount, Collected_Amount, Progress_Percentage, deadline, and fund usage information.
3. WHEN the Detail_Page renders, THE Frontend SHALL display a progress bar representing the Progress_Percentage.
4. WHEN the Detail_Page renders, THE Frontend SHALL display a control labeled "Donasi Sekarang" that navigates to the Donation_Page for that Campaign.
5. IF the Detail_Page is requested with a campaign id that does not exist, THEN THE Backend_API SHALL return a not-found result AND THE Frontend SHALL display a message stating that the campaign was not found.
6. IF the Detail_Page is requested without a campaign id, THEN THE Frontend SHALL display a message prompting the Donor to select a campaign from the Landing_Page.

### Requirement 3: Enter Donation Nominal and View Payment Instructions

**User Story:** As a Donor, I want to enter my donation amount and see payment options, so that I can send my contribution.

#### Acceptance Criteria

1. WHEN the Donation_Page renders, THE Frontend SHALL display a numeric input field for the donation nominal.
2. WHEN the Donation_Page renders, THE Frontend SHALL display the Bank Transfer instructions containing the bank_name, account_number, and account_name from the `payment` sheet.
3. WHEN the Donation_Page renders, THE Frontend SHALL display the QRIS image from the `payment` sheet.
4. WHEN the Donation_Page renders, THE Frontend SHALL display a control labeled "Konfirmasi Donasi" that navigates to the Confirmation_Form.
5. IF the donation nominal is empty, non-numeric, or less than 1, THEN THE Frontend SHALL display a validation message AND prevent navigation to the Confirmation_Form.
6. WHEN the Donor enters a valid nominal and proceeds, THE Frontend SHALL carry the campaign id and nominal value to the Confirmation_Form.

### Requirement 4: Submit Donation Confirmation

**User Story:** As a Donor, I want to confirm my donation with proof of payment, so that the administrator can verify and record my contribution.

#### Acceptance Criteria

1. WHEN the Confirmation_Form renders, THE Frontend SHALL display input fields for donor full name, donation amount, payment method, payment proof upload, and an optional note.
2. THE Frontend SHALL restrict the payment method selection to the values "Transfer" and "QRIS".
3. WHEN the Donor submits the Confirmation_Form, THE Frontend SHALL send the campaign id, name, amount, payment method, payment proof, and optional note to the Backend_API.
4. WHEN the Backend_API receives a valid donation confirmation, THE Backend_API SHALL store the uploaded payment proof in the Proof_Store AND record a Donation in the `donations` sheet with fields id, campaign_id, name, amount, payment_method, proof_image link, Donation_Status, and created_at.
5. WHEN the Backend_API records a new Donation, THE Backend_API SHALL set its Donation_Status to PENDING.
6. WHEN the Backend_API successfully records a Donation, THE Frontend SHALL display a confirmation message stating that the donation was submitted and is awaiting verification.
7. IF the donor full name is empty, the amount is less than 1, the payment method is not one of the allowed values, or the payment proof is missing, THEN THE Backend_API SHALL reject the submission AND return a validation error describing the invalid field.
8. IF the uploaded payment proof exceeds 5 megabytes or is not of type JPEG or PNG, THEN THE Backend_API SHALL reject the submission AND return an error describing the file constraint.
9. IF the Backend_API submission fails, THEN THE Frontend SHALL display an error message AND retain the data the Donor entered.

### Requirement 5: Protect Write Operations

**User Story:** As a System owner, I want write operations protected against abuse, so that the donation data is not spammed or corrupted.

#### Acceptance Criteria

1. IF a write request to the Backend_API omits a valid Write_Token, THEN THE Backend_API SHALL reject the request AND return an authorization error.
2. WHEN more than 5 donation confirmation submissions originate from the same client within 60 seconds, THE Backend_API SHALL reject further submissions from that client until the 60-second window elapses.
3. THE Backend_API SHALL validate every write request payload against the required field and type constraints before modifying the Data_Store.
4. IF a write request payload contains fields not defined for the requested operation, THEN THE Backend_API SHALL ignore the undefined fields.

### Requirement 6: Administrator Login

**User Story:** As an Administrator, I want to log in securely, so that only authorized people can verify donations.

#### Acceptance Criteria

1. WHEN an Administrator submits a username and password on the Admin_Console, THE Backend_API SHALL validate the credentials against the `admin` sheet on the server side.
2. THE Data_Store SHALL store each Administrator password as a salted hash rather than as plaintext.
3. WHEN the submitted credentials match a stored Administrator record, THE Backend_API SHALL issue a Session_Token with an expiry of no more than 12 hours.
4. IF the submitted credentials do not match any stored Administrator record, THEN THE Backend_API SHALL reject the login AND return an authentication error without indicating which field was incorrect.
5. IF an admin write request omits a valid and unexpired Session_Token, THEN THE Backend_API SHALL reject the request AND return an authorization error.

### Requirement 7: Administrator Dashboard

**User Story:** As an Administrator, I want a dashboard summary, so that I can see the donation status at a glance.

#### Acceptance Criteria

1. WHILE an Administrator holds a valid Session_Token, THE Admin_Console SHALL display the count of Campaigns whose Campaign_Status is ACTIVE.
2. WHILE an Administrator holds a valid Session_Token, THE Admin_Console SHALL display the total amount of all Donations whose Donation_Status is VERIFIED.
3. WHILE an Administrator holds a valid Session_Token, THE Admin_Console SHALL display the count of Donations whose Donation_Status is PENDING.
4. WHILE an Administrator holds a valid Session_Token, THE Admin_Console SHALL display the count of Donations whose Donation_Status is VERIFIED.

### Requirement 8: Verify or Reject Donations

**User Story:** As an Administrator, I want to verify or reject donations, so that only legitimate contributions count toward a campaign.

#### Acceptance Criteria

1. WHILE an Administrator holds a valid Session_Token, THE Admin_Console SHALL display each PENDING Donation with its donor name, amount, payment method, proof image, and Donation_Status.
2. WHEN an Administrator selects a control labeled "Terima Donasi" for a Donation, THE Backend_API SHALL set that Donation's Donation_Status to VERIFIED.
3. WHEN an Administrator selects a control labeled "Tolak Donasi" for a Donation, THE Backend_API SHALL set that Donation's Donation_Status to REJECTED.
4. THE Backend_API SHALL compute a Campaign's Collected_Amount as the sum of amount across that Campaign's Donations whose Donation_Status is VERIFIED.
5. WHEN a Donation's Donation_Status changes to VERIFIED or REJECTED, THE Backend_API SHALL recompute the affected Campaign's Collected_Amount.
6. IF an Administrator acts on a Donation whose Donation_Status is not PENDING, THEN THE Backend_API SHALL reject the action AND return a conflict error.

### Requirement 9: Campaign Status Lifecycle

**User Story:** As a System owner, I want clear campaign status rules, so that donors see accurate campaign availability.

#### Acceptance Criteria

1. WHILE a Campaign's Campaign_Status is ACTIVE, THE Frontend SHALL accept donation confirmations for that Campaign.
2. WHEN a Campaign's Collected_Amount reaches or exceeds its target_amount, THE Backend_API SHALL set that Campaign's Campaign_Status to COMPLETED.
3. WHEN the current date passes a Campaign's deadline AND the Campaign_Status is ACTIVE, THE Backend_API SHALL set that Campaign's Campaign_Status to CLOSED.
4. IF a Donor attempts to submit a donation confirmation for a Campaign whose Campaign_Status is COMPLETED or CLOSED, THEN THE Backend_API SHALL reject the submission AND return a message stating that the Campaign is no longer accepting donations.
5. WHILE a Campaign's Campaign_Status is COMPLETED or CLOSED, THE Frontend SHALL display the Campaign_Status and hide the "Donasi Sekarang" control for that Campaign.

### Requirement 10: Public Data Caching

**User Story:** As a System owner, I want public data cached, so that the site stays responsive within Apps Script quota limits.

#### Acceptance Criteria

1. WHEN the Backend_API serves public Campaign data, THE Backend_API SHALL return a response cached for a duration of no more than 5 minutes.
2. WHEN a Donation's Donation_Status changes to VERIFIED or REJECTED, THE Backend_API SHALL invalidate the cached public data for the affected Campaign.
3. WHILE cached public data is available and unexpired, THE Backend_API SHALL serve the cached data without reading the Data_Store.

### Requirement 11: Limit Donation Flow to Five Steps

**User Story:** As a Donor, I want a short donation process, so that I can complete my contribution quickly.

#### Acceptance Criteria

1. THE Frontend SHALL enable a Donor to complete a donation from campaign selection through confirmation submission in no more than 5 distinct steps.
2. WHEN the Frontend renders on a viewport width of 360 pixels or greater, THE Frontend SHALL display all donation controls without horizontal scrolling.
3. THE Frontend SHALL display the primary donation control on the Detail_Page within the initial viewport without requiring the Donor to scroll.

### Requirement 12: Notify Administrator of New Confirmations

**User Story:** As an Administrator, I want to be notified of new donation confirmations, so that I can verify them promptly.

#### Acceptance Criteria

1. WHERE administrator notifications are enabled, WHEN the Backend_API records a new Donation, THE Backend_API SHALL send a notification to the configured administrator channel containing the donor name, amount, and Campaign title.
2. IF sending the administrator notification fails, THEN THE Backend_API SHALL record the Donation successfully AND log the notification failure.
