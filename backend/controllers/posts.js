// Sample data stored in memory.
const posts = [{ id: 1, authorId: 1, text: 'Anyone want lunch at the BSC?' },
  { id: 2, authorId: 2, text: 'Looking for a study buddy.' }];

export function getPosts(req, res) {
  res.json(posts);
}
