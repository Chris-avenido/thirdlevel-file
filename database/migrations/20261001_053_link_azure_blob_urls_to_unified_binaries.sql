-- =========================================================================================
-- Migration  : 20261001_053_link_azure_blob_urls_to_unified_binaries.sql
-- Description: Reconciles and links Azure Blob Storage URLs to unified_binaries records
--              that were uploaded to Azure Blob storage (container: tlo-main) but were
--              missing the azure_blob_url reference in PostgreSQL.
--              Includes TLO-0631 PDS (ID: e3189793-3d81-49aa-a2c3-ef8ab09796c9) and 20 other
--              matching binary records.
-- Tables     : unified_binaries (UPDATE)
-- Safety     : Safe for multiple runs (only updates when matching ID exists).
-- Author     : Antigravity
-- Date       : 2026-10-01
-- =========================================================================================

BEGIN;

-- 1. TLO-0631 (Ruby Therese Almencion) - PDS & Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0631/pds/pds_TLO-0631_20260811_091601.pdf'
WHERE id = 'e3189793-3d81-49aa-a2c3-ef8ab09796c9' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0631/service_records/service_records_TLO-0631_20260811_091611.pdf'
WHERE id = 'd850ba78-dbb9-4cf1-a41d-9bed1c226ab8' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 2. TLO-0624 - Executive Summary
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0624/executive_summary/executive_summary_TLO-0624_20260811_010538.pdf'
WHERE id = 'ef7a245c-1362-444c-8b1b-0750826d6a98' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 3. TLO-0625 - Executive Summary
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0625/executive_summary/executive_summary_TLO-0625_20260811_014104.pdf'
WHERE id = '68d5b268-30fc-4d48-bf5d-14fc39121744' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 4. TLO-0629 (Mark Dela Cruz Garcia) - PDS, Service Records & Executive Summary
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0629/pds/pds_TLO-0629_20260811_053741.pdf'
WHERE id = '31c2265c-1f3b-408b-bcc2-2e287d66e2f3' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0629/service_records/service_records_TLO-0629_20260811_053728.pdf'
WHERE id = '5f1157f3-5844-4156-ba3a-288396187a24' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0629/executive_summary/executive_summary_TLO-0629_20260811_053819.pdf'
WHERE id = 'b9fffe87-8f11-4ab8-ae90-567127513d11' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 5. TLO-0626 - PDS
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0626/pds/pds_TLO-0626_20260811_030214.pdf'
WHERE id = '6e587426-811a-4d01-9dba-4133749c9db3' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 6. TLO-0316 - PDS & Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0316/pds/pds_TLO-0316_20260811_141538.pdf'
WHERE id = '631413b7-54a3-407c-9c0e-2c2964e7e369' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0316/service_records/service_records_TLO-0316_20260811_141554.pdf'
WHERE id = '0648b5a5-3079-4da1-8faa-aa484d189809' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 7. TLO-0322 (Jerson Bautista Labos) - PDS
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0322/pds/pds_TLO-0322_20260812_064519.xlsx'
WHERE id = 'c9ab8902-9087-4141-a5ea-8e07d8caff38' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 8. TLO-0323 (Marlon P. Destreza) - PDS & Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0323/pds/pds_TLO-0323_20260812_135233.xlsx'
WHERE id = '8d13ddb7-ab76-467a-9426-4dc9d7c1c997' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0323/service_records/service_records_TLO-0323_20260812_085640.pdf'
WHERE id = '040fbbed-4c96-4ff8-8972-40f8776b85d8' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 9. TLO-0325 (Ma. Luz Medroso De Los Reyes) - PDS & Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0325/pds/pds_TLO-0325_20260813_031639.pdf'
WHERE id = '4fea7dd5-a058-4edd-bf64-63d10fd3ebbb' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0325/service_records/service_records_TLO-0325_20260813_025844.pdf'
WHERE id = '9589a4fb-443f-45c4-be71-01541c0a0df5' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 10. TLO-0320 (Lea Canarios Belleza) - PDS & Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0320/pds/pds_TLO-0320_20260814_013925.pdf'
WHERE id = 'd2253ee2-e2bb-4ddc-9540-46698605ee7a' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0320/service_records/service_records_TLO-0320_20260814_020226.pdf'
WHERE id = '4a7b6bbb-9a9f-43fd-bc1c-fc1dc992f0df' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 11. TLO-0312 (Miguel Mac D. Dizon Aposin) - Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0312/service_records/service_records_TLO-0312_20260814_042935.pdf'
WHERE id = 'd9a348e1-c60c-491c-b20e-39a9b4cfd317' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 12. TLO-0326 (Eugenio Labrador Mallorca) - Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/TLO-0326/service_records/service_records_TLO-0326_20260814_050325.pdf'
WHERE id = 'b0ba0366-cfce-424a-a70c-6eca673167fb' AND (azure_blob_url IS NULL OR azure_blob_url = '');

-- 13. APP-2026-0020 (Nicasio Silvino Frio) - PDS & Service Records
UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/APP-2026-0020/pds/pds_APP-2026-0020_20260814_063943.pdf'
WHERE id = 'fb1e08d4-ce9f-4008-928f-22956aa86a85' AND (azure_blob_url IS NULL OR azure_blob_url = '');

UPDATE unified_binaries
SET azure_blob_url = 'https://strideazureblobstorage.blob.core.windows.net/tlo-main/APP-2026-0020/service_records/service_records_APP-2026-0020_20260814_052106.pdf'
WHERE id = 'aeec886c-6635-4467-a774-4a92909dd39b' AND (azure_blob_url IS NULL OR azure_blob_url = '');

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, execute the following SQL:
-- BEGIN;
-- UPDATE unified_binaries SET azure_blob_url = NULL WHERE id IN (
--   'e3189793-3d81-49aa-a2c3-ef8ab09796c9',
--   'd850ba78-dbb9-4cf1-a41d-9bed1c226ab8',
--   'ef7a245c-1362-444c-8b1b-0750826d6a98',
--   '68d5b268-30fc-4d48-bf5d-14fc39121744',
--   '31c2265c-1f3b-408b-bcc2-2e287d66e2f3',
--   '5f1157f3-5844-4156-ba3a-288396187a24',
--   'b9fffe87-8f11-4ab8-ae90-567127513d11',
--   '6e587426-811a-4d01-9dba-4133749c9db3',
--   '631413b7-54a3-407c-9c0e-2c2964e7e369',
--   '0648b5a5-3079-4da1-8faa-aa484d189809',
--   'c9ab8902-9087-4141-a5ea-8e07d8caff38',
--   '8d13ddb7-ab76-467a-9426-4dc9d7c1c997',
--   '040fbbed-4c96-4ff8-8972-40f8776b85d8',
--   '4fea7dd5-a058-4edd-bf64-63d10fd3ebbb',
--   '9589a4fb-443f-45c4-be71-01541c0a0df5',
--   'd2253ee2-e2bb-4ddc-9540-46698605ee7a',
--   '4a7b6bbb-9a9f-43fd-bc1c-fc1dc992f0df',
--   'd9a348e1-c60c-491c-b20e-39a9b4cfd317',
--   'b0ba0366-cfce-424a-a70c-6eca673167fb',
--   'fb1e08d4-ce9f-4008-928f-22956aa86a85',
--   'aeec886c-6635-4467-a774-4a92909dd39b'
-- );
-- COMMIT;
-- =========================================================================================
