# Job Source Adapters

Each adapter is a long-running data source for the Hayley HR Job Agent.

Adapter responsibilities:

1. Search jobs on the platform.
2. Fetch raw structured data where possible.
3. Convert the result into the unified Job structure.

Core filtering and scoring must stay in `job_agent.pipeline` and `job_agent.filters`.
Adding a future source such as Liepin or Indeed should only require adding a new
adapter folder and registering it in the daily runner.

`SingleUrlAdapter` is opt-in and is not registered in the daily source list. It
fetches exactly one user-provided detail URL, returns the same unified `Job`
object as every other adapter, and leaves filtering/search behavior for
LinkedIn, JobsDB, and BOSS unchanged.
