# Define mappings of files to folders
$faqMap = @{
    "account_setup.md"         = "accountsetup"
    "etf_miietf.md"            = "mahaanaetf"
    "mahaana_invest.md"        = "mahaanainvest"
    "mahaana_retirement.md"    = "mahaanaretirement"
    "save_plus.md"             = "mahaana_save+"
    "returns_performance.md"   = "returnsandperformance"
    "security.md"              = "security"
    "shariah_compliance.md"    = "shariahcompliance"
    "taxes_zakat.md"           = "taxesandzakat"
    "technology_access.md"     = "technologyandaccess"
    "withdrawals_deposits.md"  = "withdrawalsanddeposits"
    "investor_education.md"    = "general"
    "getting_started.md"       = "general"
}

# Set paths
$sourcePath = ".\mahaana_faq_md"
$targetBase = ".\content\faqs"

# Create a log file
$logPath = ".\faq_move_log.txt"
"Moving FAQ files..." | Out-File $logPath

foreach ($file in $faqMap.Keys) {
    $sourceFile = Join-Path $sourcePath $file
    $targetFolder = Join-Path $targetBase $faqMap[$file]

    # Debugging output
    Write-Host "Processing file: $file"
    Write-Host "Source file: $sourceFile"
    Write-Host "Target folder: $targetFolder"

    # Fixed the logical operation by using parentheses properly
    if ((Test-Path $sourceFile) -and (Test-Path $targetFolder)) {
        Move-Item $sourceFile -Destination $targetFolder
        Write-Host "Moved $file -> $targetFolder"
        "Moved $file -> $targetFolder" | Out-File $logPath -Append
    } else {
        Write-Host "Skipped $file (missing source or target folder)"
        "Skipped $file (missing source or target folder)" | Out-File $logPath -Append
    }
}

Write-Host "Done! Check faq_move_log.txt for details."
"Done! Check faq_move_log.txt for details." | Out-File $logPath -Append