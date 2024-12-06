const PlotlyPlugin = (function() {
    let cachedData = null;
    let columns = {};
    let params = {x: '', y: [], y2: [], type: 'line'};
    let plot = null;

    async function fetchData() {
        const jsonUrl = document.querySelector('link[rel="alternate"][type="application/json+datasette"]').href;
        const dataUrl = jsonUrl + (jsonUrl.includes('?') ? '&_shape=array' : '?_shape=array')
        const resp = await fetch(dataUrl);
        cachedData = await resp.json();
        columns = getColumns(cachedData);
    }

    function getParamsFromUrl() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        params.x = hashParams.get('plt.x') || '';
        params.y = hashParams.getAll('plt.y');
        params.y2 = hashParams.getAll('plt.y2');
        params.type = hashParams.get('plt.t') || 'line';
        if ((params.x > '') && !(params.x in columns)) {
            params.x = '';
        }
        params.y = params.y.filter(col => col in columns);
        params.y2 = params.y2.filter(col => col in columns);
    }

    function getInput(name, type, value, checked) {
        const extra = checked ? ' checked' : '';
        return `<input name="${name}" type="${type}" value="${value}"${extra} />`;
    }

    function getOption(value, label, selected) {
        const extra = selected ? ' selected' : '';
        return `<option value="${value}"${extra}>${label}</option>`;
    }

    function td(html) {
        return `<td>${html}</td>`;
    }

    function ucfirst(s) {
        return s.charAt(0).toUpperCase() + s.substring(1);
    }

    function typeName(type) {
        return (type == 'time') ? 'Date/Time' : ucfirst(type);
    }

    function allowedAsX(colType, chartType) {
        if ((chartType == 'line') || chartType.includes('area')) {
            return colType == 'numeric';
        }
        return true;
    }

    function getForm() {
        const ncols = (params.type == 'pie') ? 4 : 5;
        var html = '<form id="plotly-form"><table>';
        html += `<tr><td colspan="${ncols}"><label>Plot type: <select name="type">`;
        html += getOption('line', 'Lines', params.type=='line');
        html += getOption('area', 'Area', params.type=='area');
        html += getOption('stack-area', 'Stacked area', params.type=='stack-area');
        //html += getOption('norm-stack-area', 'Normalized stacked area', params.type=='norm-stack-area');
        html += getOption('bars', 'Bars', params.type=='bars');
        html += getOption('stack-bars', 'Stacked bars', params.type=='stack-bars');
        html += getOption('combo', 'Combo line/bars', params.type=='combo');
        html += getOption('scatter', 'Scatter', params.type=='scatter');
        html += getOption('pie', 'Pie', params.type=='pie');
        html += getOption('pie-abs', 'Pie abs. values', params.type=='pie-abs');
        html += '</select></label></td></tr>';
        if (params.type.includes('pie')) {
            html += '<tr><th>Column</th><th>Labels</th><th>Values</th><th>Axis type</td></tr>';
            for (const [name, type] of Object.entries(columns)) {
                html += '<tr>' + td(name);
                html += td(type != 'numeric' ? getInput('x', 'radio', name, name==params.x) : '');
                html += td(type == 'numeric' ? getInput('y', 'radio', name, name==params.y) : '');
                html += td(typeName(type)) + '</tr>';
            }
        } else {
            html += '<tr><th>Column</th><th>X</th><th>Y</th><th>Y2</th><th>Axis type</td></tr>';
            for (const [name, type] of Object.entries(columns)) {
                html += '<tr>' + td(name);
                html += td(allowedAsX(type, params.type) ? getInput('x', 'radio', name, name==params.x) : '');
                html += td(type == 'numeric' ? getInput('y', 'checkbox', name, name==params.y) : '');
                html += td(type == 'numeric' ? getInput('y2', 'checkbox', name, name==params.y2) : '');
                html += td(typeName(type)) + '</tr>';
            }
        }
        html += '</table>';
        html += '</form>';
        return html;
    }

    function getColumns(data) {
        const columns = {};
        for (const row of data) {
            for (const [key, val] of Object.entries(row)) {
                const valType = typeof val;
                if (key in columns) {
                    if (columns[key] == 'time') {
                        if ((valType != 'string') || (!dayjs(val).isValid())) {
                            columns[key] = 'label';
                        }
                    } else if ((columns[key] == 'numeric') && (valType != 'number')) {
                        columns[key] = 'label';
                    }
                } else {
                    if (valType == 'number') {
                        columns[key] = 'numeric';
                    } else if (dayjs(val).isValid()) {
                        columns[key] = 'time';
                    } else {
                        columns[key] = 'label';
                    }
                }
            }
        }
        return columns;
    }

    function getContent() {
        var html = '';
        html += getForm() + '<div id="plotly-chart"></div>';
        return html;
    }

    function handleInputChange(event) {
        const input = event.target;
        if (input.checked) {
            const inputs = input.closest('tr').querySelectorAll('input');
            for (const other of inputs) {
                if (other !== input) {
                    other.checked = false;
                }
            }
        }
    }

    function replaceHash(url, hash) {
        const urlObj = new URL(url);
        urlObj.hash = hash;
        return urlObj.toString();
    }

    function updateLinks() {
        const hash = window.location.hash;
        const selectors = ['.rows-and-columns th a', '.facet-results a'];
        var links = [];
        for (const sel of selectors) {
            links = links.concat(Array.from(document.querySelectorAll(sel)));
        }
        for (const link of links) {
            if (link.href) {
                link.href = replaceHash(link.href, hash);
            }
        }
        const form = document.querySelector('.content form.core');
        if (form) {
            form.action = replaceHash(form.action, hash);
        }
    }

    function updateUrl() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        hashParams.delete('plt.x');
        hashParams.delete('plt.y');
        hashParams.delete('plt.y2');
        hashParams.delete('plt.t');
        if (params.x != '') {
            hashParams.set('plt.x', params.x);
        }
        params.y.forEach(col => hashParams.append('plt.y', col));
        params.y2.forEach(col => hashParams.append('plt.y2', col));
        hashParams.set('plt.t', params.type);
        const hashStr = hashParams.toString();
        window.location.hash = hashStr;
    }

    function resizeChart() {
        if (plot != null) {
            Plotly.Plots.resize('plotly-chart');
        }
    }

    function mustReloadForm(oldPlotType, newPlotType) {
        if (oldPlotType.includes('pie') != newPlotType.includes('pie')) {
            return true;
        }
        const colTypes = new Set(Object.values(columns));
        for (const colType of colTypes) {
            if (allowedAsX(colType, oldPlotType) != allowedAsX(colType, newPlotType)) {
                return true;
            }
        }
        return false;
    }

    function addEventListeners(panel) {
        const form = panel.querySelector('#plotly-form');
        form.querySelectorAll('tr input').forEach(input => {
            input.addEventListener('change', handleInputChange);
        });
        form.addEventListener('change', (event) => {
            const formData = new FormData(event.target.form);
            const oldType = params.type;
            const newType = formData.get('type');
            params.x = formData.get('x') || '';
            params.y = formData.getAll('y');
            params.y2 = formData.getAll('y2');
            params.type = newType;
            if (mustReloadForm(oldType, newType)) {
                document.getElementById('plotly-form').innerHTML = getForm();
            }
            updateUrl();
            updateLinks();
            updateChart();
        });
        new ResizeObserver(() => resizeChart()).observe(panel);
    }

    function chartMessage(text) {
        const node = document.getElementById('plotly-chart');
        node.innerHTML = text;
    }

    function updateChart() {
        var ready = params.x > '';
        if (params.type.includes('pie')) {
            ready = ready && (params.y.length > 0);
        } else {
            ready = ready && ((params.y.length > 0) || (params.y2.length > 0));
        }
        if (!ready) {
            plot = null;
            if (params.type.includes('pie')) {
                chartMessage('The chart will apear here after selecting label and values');
            } else {
                chartMessage('The chart will appear here after selecting X and at least one of Y or Y2');
            }
            return;
        }
        var layout = {
            autosize: true,
            title: {automargin: true},
            showlegend: true,
            legend: {orientation: 'h'},
            margin: {autoexpand: true, b: 20, l: 20, r: 20, t: 20},
        };
        const traces = [];
        if (params.type.includes('pie')) {
            if (params.type == 'pie-abs') {
                traces.push({
                    labels: cachedData.map(row => row[params.x]),
                    values: cachedData.map(row => Math.abs(row[params.y[0]]))
                });
            } else {
                const positiveData = cachedData.filter(row => row[params.y[0]] > 0);
                if (positiveData.length > 0) {
                    traces.push({
                        labels: positiveData.map(row => row[params.x]),
                        values: positiveData.map(row => row[params.y[0]])
                    });
                    if (positiveData.length < cachedData.length) {
                        layout.annotations = [{
                            x: 1,
                            y: 0,
                            xref: 'paper',
                            yref: 'paper',
                            showarrow: false,
                            xanchor: 'right',
                            yanchor: 'bottom',
                            text: 'Values equal to or less than zero have been omitted.'
                        }];
                    }
                } else {
                    plot = null;
                    chartMessage('Pie chart does not support negative values');
                    return;
                }
            }
            layout.legend.orientation = 'v';
            traces[0].type = 'pie';
            // so that small values ​​are not at the bottom of the chart, because then there may be no space for labels
            traces[0].rotation = 270;
            traces[0].direction = 'clockwise';
        } else {
            var data = cachedData;
            if (columns[params.x] != 'label') {
                data = [...data].sort((a, b) => a[params.x] - b[params.x]);
            }
            const x = data.map(row => row[params.x]);
            for (y of params.y) {
                traces.push({
                    name: y,
                    x: x,
                    y: data.map(row => row[y])
                });
            }
            for (y of params.y2) {
                traces.push({
                    name: y,
                    x: x,
                    y: data.map(row => row[y]),
                    yaxis: 'y2'
                });
            }
            if (params.type.includes('area')) {
                for (trace of traces) {
                    trace.fill = 'tozeroy';
                    trace.mode = 'none';
                    if (params.type.includes('stack')) {
                        trace.stackgroup = 'one';
                    }
                }
                /*
                if (params.type == 'norm-stack-area') {
                    traces[0].groupnorm = 'percent';
                }
                */
            } else if (params.type.includes('bars')) {
                for (trace of traces) {
                    trace.type = 'bar';
                }
                if (params.type == 'stack-bars') {
                    layout.barmode = 'stack';
                }
            } else if (params.type == 'scatter') {
                for (trace of traces) {
                    trace.type = 'scatter';
                    trace.mode = 'markers';
                }
            }
            layout.xaxis = {automargin: 'height'};
            layout.yaxis = {automargin: 'width'};
            layout.yaxis2 = {automargin: 'width', side: 'right', overlaying: 'y'};
            if ((params.y.length > 0) && (params.y2.length > 0)) {
                if (params.y.length > 0) {
                    layout.yaxis.title = {
                        text: params.y.join(' / ')
                    };
                }
                if (params.y2.length > 0) {
                    layout.yaxis2.title = {
                        text: params.y2.join(' / ')
                    };
                }
            }
        }
        document.getElementById('plotly-chart').innerHTML = '';
        plot = Plotly.newPlot('plotly-chart', traces, layout);
    }

    function getMinHeight() {
        const form = document.getElementById('plotly-form');
        return Math.max(form.offsetHeight+10, 300);
    }

    async function initialize() {
        const panel = document.getElementById('plotly-panel');
        if (panel != null) {
            await fetchData();
            getParamsFromUrl();
            panel.innerHTML = getContent();
            panel.style.minHeight = getMinHeight()+'px';
            addEventListeners(panel);
            updateChart();
        }
    }

    // Public API
    return {
        initialize: initialize
    }
})();

document.addEventListener('datasette_init', PlotlyPlugin.initialize);
