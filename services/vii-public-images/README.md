# VII public image delivery

Isolated Cloudflare Worker using the existing account's native Images binding. It accepts only existing public VII media paths, finite widths/qualities/formats, and GET/HEAD. It forwards no visitor cookies or credentials, never decodes pixels inside the application Worker, prevents upscaling, and falls back to the exact original source.

Per-isolate containment: four active jobs, duplicate-key suppression,120admissions/minute and256recent keys. This is not an account-wide financial ceiling. No paid plan, subscription, secret, DNS, D1, R2 or existing Site binding is changed. Account quota failures preserve the original image through a no-store redirect.

Before initial deployment: source reviewed independently, eight actual handler tests passed, packaging dry-run identified IMAGES; readonly deployment inventory confirmed this Worker name absent in the configured account. Operation identity: `vii-public-images-20261104-initial`, attempt1, one deployment only. An uncertain result must be inspected through deployment inventory before any further mutation.

Main-site wiring remains blocked until real deployed output has the native engine header and verified dimensions, MIME and bytes for the same original image. Preserve existing original-image fallback in the consuming component. The workers.dev address is an intentional stable service endpoint, not a preview of the main website.
