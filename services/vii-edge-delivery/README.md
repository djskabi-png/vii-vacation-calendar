# VII isolated edge delivery experiment

This worker is workers.dev-only and hardcodes the verified staging Site origin. It is not attached to `vii.spaplus.co`, DNS, or any production route. It caches only anonymous HTML/RSC discovery requests, rejects unknown query keys and private/session/action/API paths, and requires the expected origin build ID before storing a response. Build ID changes invalidate the namespace by deployment configuration.
