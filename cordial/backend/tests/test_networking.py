import unittest
import asyncio
from datetime import datetime, timedelta, timezone

from app.services.networking import employment_confidence, message_variants, normalize_contact, review_message, score_candidate
from app.services.providers import LocalTokenEmbeddingProvider, MockEmailProvider


class NetworkingServiceTests(unittest.TestCase):
    def test_normalizes_aliases_title_and_skills(self):
        contact = normalize_contact({
            "first_name": "  Noor ",
            "last_name": " Hassan ",
            "company": "Royal Bank of Canada",
            "position": "Senior DevOps Engineer",
            "school": "York U",
            "skills": "Python; Kubernetes; DevOps",
            "graduation_year": "2022",
        })
        self.assertEqual(contact["name"], "Noor Hassan")
        self.assertEqual(contact["company"], "RBC")
        self.assertEqual(contact["school"], "York University")
        self.assertEqual(contact["role_family"], "platform_engineering")
        self.assertEqual(contact["seniority"], "senior")
        self.assertEqual(contact["graduation_year"], 2022)

    def test_employment_confidence_preserves_all_four_states(self):
        recent = datetime.now(timezone.utc) - timedelta(days=20)
        self.assertEqual(employment_confidence([])["status"], "UNVERIFIED")
        self.assertEqual(employment_confidence([{
            "source_type": "OFFICIAL_COMPANY", "observed_at": recent,
            "reliability_weight": 0.95, "supports_current": True,
        }])["status"], "VERIFIED_CURRENT")
        self.assertEqual(employment_confidence([{
            "source_type": "PUBLIC_BIO", "observed_at": recent,
            "reliability_weight": 0.75, "supports_current": True,
        }])["status"], "LIKELY_CURRENT")
        self.assertEqual(employment_confidence([{
            "source_type": "PUBLIC_BIO", "observed_at": recent,
            "reliability_weight": 0.75, "supports_current": False,
        }])["status"], "POSSIBLY_OUTDATED")
        naive_recent = datetime.now() - timedelta(days=20)
        self.assertEqual(employment_confidence([{
            "source_type": "OFFICIAL_COMPANY", "observed_at": naive_recent,
            "reliability_weight": 0.95, "supports_current": True,
        }])["status"], "VERIFIED_CURRENT")

    def test_transparent_score_rewards_campaign_alignment(self):
        campaign = {
            "target_companies": ["Intuit"], "target_roles": ["software engineering"],
            "relevant_schools": ["York University"], "shared_employers": [],
            "relevant_skills": ["Python", "TypeScript"], "preferred_locations": ["Toronto"],
            "graduation_year_range": [2020, 2025],
        }
        aligned = normalize_contact({
            "name": "Demo Person", "company": "Intuit Canada", "position": "Software Engineer",
            "school": "York University", "skills": ["Python", "TypeScript"],
            "location": "Toronto, ON", "graduation_year": 2022, "connected_on": "2024-01-01",
        })
        other = normalize_contact({"name": "Other Person", "company": "Other Co", "position": "Accountant"})
        aligned_score = score_candidate({**aligned, "employment_confidence": {"confidence": 90}}, campaign)
        other_score = score_candidate({**other, "employment_confidence": {"confidence": 0}}, campaign)
        self.assertGreater(aligned_score["score"], other_score["score"])
        self.assertEqual(aligned_score["breakdown"][0]["key"], "target_company_match")
        self.assertEqual(aligned_score["algorithm_version"], "deterministic-v1")

    def test_message_variants_use_different_strategies(self):
        contact = normalize_contact({"first_name": "Avery", "company": "Intuit", "position": "Software Engineer", "school": "York University"})
        campaign = {"objective": "learn about platform engineering", "relevant_schools": ["York University"], "intended_ask": "Open to a 15-minute chat?"}
        drafts = message_variants(contact, campaign, {"name": "Omar"})
        self.assertEqual(len(drafts), 2)
        self.assertEqual({draft["strategy"] for draft in drafts}, {"SHARED_CONTEXT", "DIRECT_RELEVANCE"})
        self.assertNotEqual(drafts[0]["body"], drafts[1]["body"])
        self.assertIn("Intuit", drafts[0]["evidence_used"])
        self.assertNotIn("our shared York University", drafts[0]["body"])

    def test_mock_provider_never_makes_a_network_request(self):
        result = asyncio.run(MockEmailProvider().send(
            recipient="person@demo.invalid", subject="Hello", body="Grounded body", sender_id="owner-1",
        ))
        self.assertEqual(result["status"], "SENT")
        self.assertFalse(result["network_request_made"])
        self.assertTrue(result["provider_message_id"].startswith("mock-"))

    def test_local_embedding_is_normalized_and_deterministic(self):
        provider = LocalTokenEmbeddingProvider(dimensions=16)
        first = asyncio.run(provider.embed("AI platform engineering"))
        second = asyncio.run(provider.embed("AI platform engineering"))
        self.assertEqual(first, second)
        self.assertAlmostEqual(sum(value * value for value in first), 1.0)

    def test_quality_review_blocks_fake_familiarity_and_pressure(self):
        review = review_message("As you remember, we met before. You must reply urgently.", ["Intuit"])
        self.assertEqual(review["status"], "BLOCKED")
        self.assertGreaterEqual(len(review["issues"]), 2)


if __name__ == "__main__":
    unittest.main()
