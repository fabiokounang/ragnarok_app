-- Real-life class paths: Novice hub + 8 first jobs (Swordsman/Knight path ... All-Rounder).
USE reborn;

INSERT INTO jobs (id, slug, name, description, tier, parent_job_id, sort_order) VALUES
(1, 'novice', 'Novice', 'The beginner path: build consistency across sleep, hydration, movement, space, reading, and follow-through before you specialize. Pick your first class when you hit the level gate.', 0, NULL, 0),
(2, 'knight', 'Swordsman', 'The warrior path: discipline, strength, courage, and consistency. For players who want physical progress, mental toughness, and reliable structure — strength, endurance, routine, and action despite discomfort.', 1, NULL, 10),
(3, 'archer', 'Archer', 'The path of precision: focus, patience, timing, and accuracy. For students, coders, creators, and anyone fighting distraction — sharpen attention and hit important targets with consistency.', 1, NULL, 20),
(4, 'mage', 'Mage', 'Knowledge & intelligence: reading, courses, writing, tech and strategy.', 1, NULL, 30),
(5, 'acolyte', 'Acolyte', 'The healer path: mind, emotion, energy, and inner stability. For anyone seeking peace, emotional growth, and a calmer inner life — meditation, reflection, gratitude, gentle body care, and kind connection.', 1, NULL, 40),
(6, 'assassin', 'Rogue', 'Thief / Assassin path: the fast executor — speed, decisiveness, adaptability, and efficient action. For anyone stuck in overthinking who needs momentum and habits of immediate execution.', 1, NULL, 50),
(7, 'merchant', 'Merchant', 'The builder of value, money, systems, and opportunity. For entrepreneurs, freelancers, sellers, and creators who monetize — sales, marketing, offers, tracking, and financial intelligence.', 1, NULL, 60),
(8, 'blacksmith', 'Blacksmith', 'The creator and system crafter: code, UI, products, and iteration. For developers, designers, makers, and technical builders — turn ideas into working form.', 1, NULL, 70),
(9, 'all_rounder', 'All-Rounder', 'Balanced class path after Novice: same four-pillar dailies (physical, mental, money, learning) for players who want breadth without a narrow spec.', 1, NULL, 80);

ALTER TABLE jobs AUTO_INCREMENT = 100;
