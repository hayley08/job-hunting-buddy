# Job Source Adapters

Each adapter is a long-running data source for the Hayley HR Job Agent.

Adapter responsibilities:

1. Search jobs on the platform.
2. Fetch raw structured data where possible.
3. Convert the result into the unified Job structure.

Core filtering and scoring must stay in `job_agent.pipeline` and `job_agent.filters`.
Adding a future source such as Liepin or Indeed should only require adding a new
adapter folder and registering it in the daily runner.
