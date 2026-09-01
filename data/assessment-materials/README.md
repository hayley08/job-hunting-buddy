# Assessment source material archive

Original assessment files are stored append-only under:

```text
data/assessment-materials/<testId>/<materialId>.<extension>
```

Each file must have a matching `sourceMaterials` entry in `data/tests.json`.
Use `storageRef` for the repository-relative original file path, `rawContent` for
faithful extracted/OCR/page text, and `contentHash` for integrity and duplicate
detection. Web and pasted-text sources may omit `storageRef` when their exact
content is preserved in `rawContent` with the original `sourceUrl` where
available.

Never overwrite or delete an older raw source when new material arrives. Never
use archived source text directly as the table's 测试重点; the table reads only
the separately generated `assessmentSummary.conciseBullets`.
