import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));
    return data;
}

function processCommits(data) {
    return d3.groups(data, d => d.commit).map(([commit, lines]) => {
        let first = lines[0];
        let { author, date, time, timezone, datetime } = first;

        return {
            id: commit,
            url: 'https://github.com/vis-society/lab-7/commit/' + commit,
            author,
            date,
            time,
            timezone,
            datetime,
            hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
            totalLines: lines.length,
            lines
        };
    })
    .sort((a, b) => a.datetime - b.datetime); 
};

function weekDay(commits) {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const counts = Array(7).fill(0);

    for (let c of commits) {
        counts[c.datetime.getDay()]++;
    }

    return days.map((day, i) => ({ day, count: counts[i] }));
}

function longestFile(data) {
    const fileLengths = d3.rollups(
        data,
        v => d3.sum(v, d => d.length),
        d => d.file
    );

    const [file, length] = fileLengths.sort((a, b) => d3.descending(a[1], b[1]))[0];
    return { file, length };
}

function countFiles(data) {
    return new Set(data.map(d => d.file)).size;
}

function isCommitSelected(selection, commit, xScale, yScale) {
    if (!selection) return false;

    const [[x0, y0], [x1, y1]] = selection;

    const cx = xScale(commit.datetime);
    const cy = yScale(commit.hourFrac);

    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
}

function renderCommitInfo(data, commits) {
    d3.select('#stats').html('');

    const dl = d3.select('#stats')
        .append('dl')
        .attr('class', 'stats');

    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);

    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);

    const topDay = weekDay(commits)
        .sort((a, b) => b.count - a.count)[0];

    dl.append('dt').text('Most active day');
    dl.append('dd').text(topDay?.day ?? 'N/A');

    const longest = longestFile(data);

    dl.append('dt').text('Longest file');
    dl.append('dd').text(
        `${longest.file} (${longest.length} lines)`
    );

    dl.append('dt').text('Number of files');
    dl.append('dd').text(countFiles(data));
}

let xScale;
let yScale;
let xAxis;
let dots;
let svg;

function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;

    d3.select('#chart').html('');
    svg = d3.select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    const margin = { top: 10, right: 10, bottom: 30, left: 20 };

    const usable = {
        left: margin.left,
        right: width - margin.right,
        top: margin.top,
        bottom: height - margin.bottom,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    xScale = d3.scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([usable.left, usable.right])
        .nice();

    yScale = d3.scaleLinear()
        .domain([0, 24])
        .range([usable.bottom, usable.top]);

    xAxis = d3.axisBottom(xScale);

    const yAxis = d3.axisLeft(yScale);

    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${usable.bottom})`)
        .call(xAxis);

    svg.append('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(${usable.left}, 0)`)
        .call(yAxis);

    svg.append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usable.left},0)`)
        .call(
            d3.axisLeft(yScale)
                .tickSize(-usable.width)
                .tickFormat('')
    );

    dots = svg.append('g').attr('class', 'dots');
    

    updateScatterPlot(commits);
}
function updateScatterPlot(commits) {
    // 1. update scale
    xScale.domain(d3.extent(commits, d => d.datetime));

    // 2. recompute axis (IMPORTANT: rebind scale explicitly)
    const xAxis = d3.axisBottom(xScale);

    svg.select('.x-axis')
        .call(xAxis);

    // 3. update gridlines (you currently never update them)
    svg.select('.gridlines')
        .call(
            d3.axisLeft(yScale)
                .tickSize(-xScale.range()[1] + xScale.range()[0])
                .tickFormat('')
        );

    // 4. radius scale
    const [minLines, maxLines] =
        d3.extent(commits, d => d.totalLines);

    const rScale = d3.scaleSqrt()
        .domain([minLines, maxLines])
        .range([2, 30]);

    // 5. render dots
    const sortedCommits = d3.sort(commits, d => -d.totalLines);

    dots.selectAll('circle')
        .data(sortedCommits, d => d.id)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7);
}

function renderApp(data, commits) {
    renderCommitInfo(data, commits);
    renderScatterPlot(data, commits);
}

let data = await loadData();
let commits = processCommits(data);
let filteredCommits = commits;

renderApp(data, commits);

let commitProgress = 100;
let timeScale = d3
    .scaleTime()
    .domain([
        d3.min(commits, (d) => d.datetime),
        d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);
let commitMaxTime = timeScale.invert(commitProgress);

const timeSlider = document.getElementById('commit-progress');
const timeDisplay = document.getElementById('commit-time');
let colors = d3.scaleOrdinal(d3.schemeTableau10);
function updateFileDisplay(filteredCommits){
    let lines = filteredCommits.flatMap((d) => d.lines);
    let files = d3
        .groups(lines, (d) => d.file)
        .map(([name, lines]) => {
            return {
                name,
                lines,
                type: lines[0].type   // 👈 key fix
            };
        })
        .sort((a, b) => b.lines.length - a.lines.length);

    let filesContainer = d3
        .select('#files')
        .selectAll('div')
        .data(files, (d) => d.name)
        .join(
        // This code only runs when the div is initially rendered
            (enter) =>
            enter.append('div').call((div) => {
                div.append('dt').append('code');
                div.append('dd');
            }),
        )
        .attr('style', d => `--color: ${colors(d.type)}`);

    // This code updates the div info
    filesContainer.select('dt > code').text((d) => d.name);
    filesContainer.select('dd')
        .selectAll('div')
        .data(d => d.lines)
        .join('div')
        .attr('class', 'loc');
}



function onTimeSliderChange() {
    commitProgress = +timeSlider.value;
    commitMaxTime = timeScale.invert(commitProgress);
    timeDisplay.textContent =
        commitMaxTime.toLocaleString();
    filteredCommits = commits.filter(
        d => d.datetime <= commitMaxTime
    );
    updateScatterPlot(filteredCommits);
    renderCommitInfo(data, filteredCommits);
    updateFileDisplay(filteredCommits)
}



timeSlider.addEventListener('input', onTimeSliderChange);
onTimeSliderChange();
renderApp(data, commits);

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
		On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
		I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
		I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file,
      ).length
    } files.
		Then I looked over all I had made, and I saw that it was very good.
	`,
  );


function onStepEnter(response) {
    const commit = response.element.__data__;

    const filtered = commits.filter(
        d => d.datetime <= commit.datetime
    );

    updateScatterPlot(filtered);
    renderCommitInfo(data, filtered);
    updateFileDisplay(filtered);
}

const scroller = scrollama();

scroller
    .setup({
        container: '#scrolly-1',
        step: '#scrolly-1 .step',
        offset: 0.5
    })
    .onStepEnter(onStepEnter);