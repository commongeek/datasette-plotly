const PlotlyPlugin = (function() {
    let cachedData = null;
    let columns = {};
    let params = {x: '', y: [], y2: [], type: 'line', o: '', h: '', l: '', c: ''};
    let plot = null;

    function appendQueryString(url, qs) {
        const op = url.includes('?') ? '&' : '?';
        return url+op+qs
    }

    async function fetchData() {
        const jsonUrl = document.querySelector('link[rel="alternate"][type="application/json+datasette"]').href;
        const dataUrl = appendQueryString(jsonUrl, '_shape=array&_size=max');
        const resp = await fetch(dataUrl);
        cachedData = await resp.json();
        columns = getColumns(cachedData);
    }

    function loadParamsFromUrl() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        for (const par of ['x', 'o', 'h', 'l', 'c']) {
            const col = hashParams.get(`plt.${par}`);
            params[par] = (col in columns) ? col : '';
        }
        for (const par of ['y', 'y2']) {
            const cols = hashParams.getAll(`plt.${par}`);
            params[par] = cols.filter(col => col in columns);
        }
        params.type = hashParams.get('plt.t') || 'line';
    }

    function loadParamsFromForm(form) {
        const formData = new FormData(form);
        for (const par of ['x', 'o', 'h', 'l', 'c']) {
            params[par] = formData.get(par) || '';
        }
        for (const par of ['y', 'y2']) {
            params[par] = formData.getAll(par);
        }
        params.type = formData.get('type');
    }

    function loadParamsFromLocalStorage() {

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

    function allowedAsX(colType, plotType) {
        if ((plotType == 'line') || plotType.includes('area')) {
            return colType != 'label';
        } else if (plotType == 'ohlc') {
            return colType == 'time';
        }
        return true;
    }

    function selectForColumns(name, allowedTypes, selected) {
        var html = `<select name="${name}">`;
        for (const [colName, colType] of Object.entries(columns)) {
            if (allowedTypes.includes(colType)) {
                const extra = (colName == selected) ? ' selected' : '';
                html += `<option${extra}>${colName}</option>`;
            }
        }
        html += '</select>';
        return html;
    }

    function getForm() {
        const ncols = (params.type == 'pie') ? 4 : (params.type == 'ohlc' ? 2 : 5);
        var html = '<form id="plotly-form"><table>';
        html += `<tr><td colspan="${ncols}"><label>Plot type: <select name="type">`;
        html += getOption('line', 'Lines', params.type=='line');
        html += getOption('scatter', 'Scatter', params.type=='scatter');
        html += getOption('ohlc', 'OHLC', params.type=='ohlc');
        html += '<hr>';
        html += getOption('area', 'Area', params.type=='area');
        html += getOption('stack-area', 'Stacked area', params.type=='stack-area');
        html += '<hr>';
        //html += getOption('norm-stack-area', 'Normalized stacked area', params.type=='norm-stack-area');
        html += getOption('bars', 'Bars', params.type=='bars');
        html += getOption('stack-bars', 'Stacked bars', params.type=='stack-bars');
        html += '<hr>';
        //html += getOption('combo', 'Combo line/bars', params.type=='combo');
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
        } else if (params.type == 'ohlc') {
            /*
            html += '<tr><th>Column</th><th>X</th><th>O</th><th>H</th><th>L</th><th>C</th><th>Axis type</td></tr>';
            for (const [name, type] of Object.entries(columns)) {
                html += '<tr>' + td(name);
                html += td(allowedAsX(type, 'ohlc') ? getInput('x', 'radio', name, name==params.x) : '');
                if (type == 'numeric') {
                    for (const field of ['o', 'h', 'l', 'c']) {
                        html += td(getInput(field, 'radio', name, name==params[field]));
                    }
                } else {
                    html += '<td></td><td></td><td></td><td></td>';
                }
                html += td(typeName(type)) + '</tr>';
            }
            */
            html += '<tr><th>Time:</th><td>' + selectForColumns('x', ['time'], params.x) + '</td></tr>';
            html += '<tr><th>Open:</th><td>' + selectForColumns('o', ['numeric'], params.o) + '</td></tr>';
            html += '<tr><th>High:</th><td>' + selectForColumns('h', ['numeric'], params.h) + '</td></tr>';
            html += '<tr><th>Low:</th><td>' + selectForColumns('l', ['numeric'], params.l) + '</td></tr>';
            html += '<tr><th>Close:</th><td>' + selectForColumns('c', ['numeric'], params.c) + '</td></tr>';
        } else {
            html += '<tr><th>Column</th><th>X</th><th>Y</th><th>Y2</th><th>Axis type</td></tr>';
            for (const [name, type] of Object.entries(columns)) {
                html += '<tr>' + td(name);
                html += td(allowedAsX(type, params.type) ? getInput('x', 'radio', name, name==params.x) : '');
                if (type == 'numeric') {
                    html += td(getInput('y', 'checkbox', name, name==params.y));
                    html += td(getInput('y2', 'checkbox', name, name==params.y2));
                } else {
                    html += '<td></td><td></td>';
                }
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
        for (const par of ['x', 'y', 'y2', 't', 'o', 'h', 'l', 'c']) {
            hashParams.delete(`plt.${par}`);
        }
        for (const par of ['x', 'o', 'h', 'l', 'c']) {
            if (params[par] > '') {
                hashParams.set(`plt.${par}`, params[par]);
            }
        }
        for (const par of ['y', 'y2']) {
            params[par].forEach(col => hashParams.append(`plt.${par}`, col));
        }
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
        if ((oldPlotType == 'ohlc') != (newPlotType == 'ohlc')) {
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
            const oldType = params.type;
            loadParamsFromForm(event.target.form);
            if (mustReloadForm(oldType, params.type)) {
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

    function readyToPlot() {
        if (params.x == '') {
            return false;
        }
        if (params.type.includes('pie')) {
            return params.y.length > 0;
        }
        if (params.type == 'ohlc') {
            return (params.o > '') && (params.h > '') && (params.l > '') && (params.c > '');
        }
        return (params.y.length > 0) || (params.y2.length > 0);
    }

    function getSortedData(sortKey) {
        return [...cachedData].sort((a, b) => a[params.x] - b[params.x]);
    }

    function updateChart() {
        if (!readyToPlot()) {
            plot = null;
            if (params.type.includes('pie')) {
                chartMessage('The chart will apear here after selecting label and values.');
            } else if (params.type == 'ohlc') {
                chartMessage('The chart will appear here after selecting all columns: X, O, H, L and C.');
            } else {
                chartMessage('The chart will appear here after selecting X and at least one of Y or Y2.');
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
        } else if (params.type == 'ohlc') {
            const data = getSortedData();
            traces.push({
                x: data.map(row => row[params['x']]),
                open: data.map(row => row[params['o']]),
                high: data.map(row => row[params['h']]),
                low: data.map(row => row[params['l']]),
                close: data.map(row => row[params['c']]),
                type: 'ohlc'
            });
            layout.showlegend = false;
            layout.xaxis = {autorange: true, type: 'date'};
        } else {
            const data = (columns[params.x] == 'label') ? cachedData : getSortedData();
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
            loadParamsFromUrl();
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
