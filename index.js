import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

console.log("index.js loaded");
const projects = await fetchJSON('./lib/projects.json');
console.log(projects);
const latestProjects = projects.slice(0, 3);
const projectsContainer = document.querySelector('.projects');
console.log(projectsContainer);

renderProjects(latestProjects, projectsContainer, 'h2');
const githubData = await fetchGitHubData('surai1020')
const profileStats = document.querySelector('#profile-stats')
if (profileStats) {
  profileStats.innerHTML = `
        <dl>
          <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
          <dt>Updated:</dt><dd>${githubData.updated_at}</dd>
          <dt>Followers:</dt><dd>${githubData.followers}</dd>
          <dt>Following:</dt><dd>${githubData.following}</dd>
        </dl>
    `;
}
