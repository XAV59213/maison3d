"""Single tag-triggered release workflow, no per-version publish files."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

import importlib.util
_spec = importlib.util.spec_from_file_location("release_notes", ROOT / "scripts" / "release_notes.py")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
extract = _mod.extract


class ReleaseWorkflow(unittest.TestCase):
    def test_single_release_workflow_on_version_tags(self):
        workflow = ROOT / ".github" / "workflows" / "release.yml"
        self.assertTrue(workflow.is_file())
        text = workflow.read_text(encoding="utf-8")
        self.assertIn("tags:", text)
        self.assertRegex(text, r'version["\']?\)?\s*!=')
        self.assertIn("scripts/release_notes.py", text)
        self.assertIn("gh release create", text)
        self.assertIn("tests/headless/test_motion_reduced.mjs", text)
        self.assertFalse(list((ROOT / ".github" / "workflows").glob("publish-*.yml")))

    def test_changelog_section_is_extracted(self):
        title, body = extract("v2.12.0", ROOT / "CHANGELOG.md")
        self.assertTrue(title.startswith("Maison 3D v2.12.0"))
        self.assertIn("capteurs de diagnostic", body.lower())
        with self.assertRaises(ValueError):
            extract("v0.0.0", ROOT / "CHANGELOG.md", ROOT / "missing-notes")

    def test_contributing_documents_the_procedure(self):
        text = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        self.assertIn("git tag vX.Y.Z", text)
        self.assertIn("CHANGELOG.md", text)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("CONTRIBUTING.md", readme)
        self.assertNotIn("— v2.3.6", readme)
        self.assertNotIn("— v2.3.5", readme)


if __name__ == "__main__":
    unittest.main()
