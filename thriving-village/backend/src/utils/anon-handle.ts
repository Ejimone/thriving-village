const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, avoids look-alike confusion

/**
 * Generates a stable, random "Entry A12"-style handle shared by every judge
 * who views a given submission — independent per submission, so it can't be
 * used to pivot to identity or to any other submission's handle.
 */
export async function generateAnonHandle(strapi: any): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const digits = String(Math.floor(Math.random() * 90) + 10);
    const handle = `Entry ${letter}${digits}`;
    const existing = await strapi.db.query('api::academy-submission.academy-submission').findOne({
      where: { anonHandle: handle },
    });
    if (!existing) return handle;
  }
  throw new Error('Could not generate a unique anonymous handle.');
}
