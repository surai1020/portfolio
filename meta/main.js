import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
    });
}

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
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);

    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);

    const topDay = weekDay(commits).sort((a,b) => b.count - a.count)[0];

    dl.append('dt').text('Most active day');
    dl.append('dd').text(topDay.day);

    const longest = longestFile(data);

    dl.append('dt').text('Longest file');
    dl.append('dd').text(`${longest.file} (${longest.length} lines)`);

    dl.append('dt').text('Number of files');
    dl.append('dd').text(countFiles(data));
}

function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;

    const svg = d3.select('#chart')
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

    const xScale = d3.scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([usable.left, usable.right])
        .nice();

    const yScale = d3.scaleLinear()
        .domain([0, 24])
        .range([usable.bottom, usable.top]);

    svg.append('g')
        .attr('transform', `translate(0, ${usable.bottom})`)
        .call(d3.axisBottom(xScale));

    svg.append('g')
        .attr('transform', `translate(${usable.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, '0') + ':00'));

    svg.append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usable.left},0)`)
        .call(d3.axisLeft(yScale).tickSize(-usable.width).tickFormat(''));

    const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);

    const rScale = d3.scaleLinear()
        .domain([minLines, maxLines])
        .range([2, 30]);

    const dots = svg.append('g');

    const sorted = d3.sort(commits, (a, b) => d3.descending(a.totalLines, b.totalLines));

    function renderSelectionCount(selection) {
        const selected = selection
            ? commits.filter(d => isCommitSelected(selection, d, xScale, yScale))
            : [];

        d3.select('#selection-count')
            .text(`${selected.length || 'No'} commits selected`);
    }

    function renderLanguageBreakdown(selection) {
        const selected = selection
            ? commits.filter(d => isCommitSelected(selection, d, xScale, yScale))
            : [];

        const container = document.getElementById('language-breakdown');

        if (!selected.length) {
            container.innerHTML = '';
            return;
        }

        const lines = selected.flatMap(d => d.lines);

        const breakdown = d3.rollup(lines, v => v.length, d => d.type);

        container.innerHTML = '';

        for (const [lang, count] of breakdown) {
            container.innerHTML += `<dt>${lang}</dt><dd>${count}</dd>`;
        }
    }

    function renderTooltipContent(commit) {
        document.getElementById('commit-link').href = commit.url;
        document.getElementById('commit-link').textContent = commit.id;

        document.getElementById('commit-date').textContent =
            commit.datetime?.toLocaleString('en', { dateStyle: 'full' });
    }

    function updateTooltipVisibility(show) {
        document.getElementById('commit-tooltip').hidden = !show;
    }

    function updateTooltipPosition(event) {
        const tooltip = document.getElementById('commit-tooltip');
        tooltip.style.left = `${event.pageX}px`;
        tooltip.style.top = `${event.pageY}px`;
    }

    dots.selectAll('circle')
        .data(sorted)
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7)
        .on('mouseenter', (event, d) => {
            d3.select(event.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(d);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        });

    const brush = d3.brush().on('start brush end', brushed);

    svg.call(brush);

    function brushed(event) {
        const selection = event.selection;

        dots.selectAll('circle')
            .classed('selected', d => isCommitSelected(selection, d, xScale, yScale));

        renderSelectionCount(selection);
        renderLanguageBreakdown(selection);
    }
}

function renderApp(data, commits) {
    renderCommitInfo(data, commits);
    renderScatterPlot(data, commits);
}

let data = await loadData();
let commits = processCommits(data);

renderApp(data, commits);