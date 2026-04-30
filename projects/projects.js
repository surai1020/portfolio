import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const titleElement = document.querySelector('.projects-title');
titleElement.textContent = `Projects (${projects.length})`;

let colors = d3.scaleOrdinal(d3.schemeTableau10);
let selectedYear = null;

let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  let query = event.target.value.toLowerCase();

  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join(' ').toLowerCase();
    return values.includes(query);
  });

  selectedYear = null;

  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
});

renderPieChart(projects);

function renderPieChart(projectsGiven) {
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  );

  let newData = newRolledData.map(([year, count]) => {
    return { label: year, value: count };
  });

  let newSliceGenerator = d3.pie().value(d => d.value);
  let newArcData = newSliceGenerator(newData);
  let newArcGenerator = d3.arc().innerRadius(0).outerRadius(50);

  let svg = d3.select('#projects-plot');
  let legend = d3.select('.legend');

  svg.selectAll('path')
    .data(newArcData)
    .join('path')
    .attr('d', d => newArcGenerator(d))
    .attr('fill', d => colors(d.data.label))
    .attr('class', d =>
      selectedYear === null
        ? ''
        : d.data.label === selectedYear
        ? 'selected'
        : 'faded'
    )
    .on('click', (event, d) => {
      selectedYear = selectedYear === d.data.label ? null : d.data.label;
      renderPieChart(projectsGiven);
    });

  legend.selectAll('li')
    .data(newData)
    .join('li')
    .attr('style', d => `--color:${colors(d.label)}`)
    .attr('class', d =>
      selectedYear === null
        ? ''
        : d.label === selectedYear
        ? 'selected'
        : 'faded'
    )
    .html(d => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);

  if (selectedYear === null) {
    renderProjects(projectsGiven, projectsContainer, 'h2');
  } else {
    let filtered = projectsGiven.filter(
      (p) => p.year === selectedYear
    );

    renderProjects(filtered, projectsContainer, 'h2');
  }
}