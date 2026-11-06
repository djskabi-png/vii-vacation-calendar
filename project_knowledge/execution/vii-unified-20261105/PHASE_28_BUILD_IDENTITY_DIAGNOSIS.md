# Phase28 source and archive identity discrepancy

The owning Cloud task rejected the phase27 archive before save because its
compiled namespace5fb4bb74 differed from Linux source namespace38e3dd9d.
The whole archive transport succeeded; no credential, source sync, Site Version,
deployment or Worker upload was performed by that operation.

Root independently compared the same2372 source inputs from frozen c557 Git
blobs against the Windows checkout. Exactly7 files differed after the old
canonicalization:4 Python scripts,1 JSONC configuration,1 gitignore and public
_headers. All differences are newline style: these text classes were absent
from the old classifier while core.autocrlf=true creates Windows CRLF files.
The committed source was not stale and the archive was not altered in transfer.

The smallest repair extends text classification for infrastructure scripts,
JSONC and the named extensionless hosting/git files. Binary bytes stay exact.
A new test reproduced the defect before the fix (5passed/1failed), then passed
after it. Related artifact admission and release input tests run separately.
Independent reviewer confirmed this mechanism and requires committed Git-blob
versus local equality before rebuilding only the Site. Existing controller,
browser, Edge and images artifacts retain original source identities and must
pass transitive-input equality rather than be rebuilt without a code change.

Phase27 is retained as historical local qualification, but its Site archive and
build identity are superseded and cannot be published. New immutable source,
Site archive, manifest and remote parity proof are required before any write.
Diagnostic evidence: .qa-output/phase28-source-build-parity.json.
