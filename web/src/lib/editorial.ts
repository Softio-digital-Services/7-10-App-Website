/**
 * Campaign imagery used on the home and about pages.
 * Swap these for your own photos (e.g. "/brand/campaign-1.jpg" in /public) when they're ready.
 */

const unsplash = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const editorial = {
  story: unsplash("1520975954732-35dd22299614", 1400),
  lookbook: unsplash("1558769132-cb1aea458c5e", 2000),
  aboutHero: unsplash("1548883354-94bcfe321cbb", 1600),
  aboutGrid: [
    unsplash("1507680434567-5739c80be1ac", 1000),
    unsplash("1593030761757-71fae45fa0e7", 1000),
    unsplash("1523381210434-271e8be1f52b", 1000),
  ],
  help: unsplash("1512436991641-6745cdb1723f", 1400),
  auth: unsplash("1614975059251-992f11792b9f", 1400),
};
