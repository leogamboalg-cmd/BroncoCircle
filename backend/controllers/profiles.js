// Sample data stored in memory.
const profiles = [{ id: 1, name: 'Alex', major: 'Computer Science', interests: ['soccer'] },
  { id: 2, name: 'Jordan', major: 'Mechanical Engineering', interests: ['gaming'] }];

export function getProfiles(req, res) {
  res.json(profiles);
}
