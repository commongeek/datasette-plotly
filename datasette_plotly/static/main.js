const PlotlyPlugin = (function() {
    let cachedData = null;
    let columns = {};
    let params = {x: '', y: [], y2: [], type: 'line', stack: false, agg: false, };
    let plot = null;
    let help = {
        'line': 'To build a line chart, select X and at least one of Y or Y2.',
        'bar': 'To build a bar chart, select X and at least one of Y or Y2.',
        'scatter': 'To build a scatter chart, select X and at least one of Y or Y2.',
        'area': 'To build a area chart, select X and at least one of Y or Y2.',
        'pie': 'To build a pie chart, select X and one and only one of Y.',
    }

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
        const x = hashParams.get('plt.x');
        params.x = (x in columns) ? x : '';
        for (const par of ['y', 'y2']) {
            const cols = hashParams.getAll(`plt.${par}`);
            params[par] = cols.filter(col => columns.hasOwnProperty(col));
        }
        params.type = hashParams.get('plt.t') || 'line';
        params.stack = hashParams.get('plt.s') == '1';
        //params.agg = hashParams.get('plt.a') == '1';
    }

    function updateParamsFromForms() {
        const tracesForm = document.getElementById('plotly-traces');
        const traces = new FormData(tracesForm);
        params.x = traces.get('x') || '';
        for (const par of ['y', 'y2']) {
            params[par] = traces.getAll(par);
        }
        const configForm = document.getElementById('plotly-config');
        const formData = new FormData(configForm);
        params.type = formData.get('type');
        params.stack = formData.get('stack') == '1';
        //params.agg = config.get('agg') == '1';
    }

    function loadParamsFromLocalStorage() {

    }

    function getInput(name, type, value, checked) {
        const extra = checked ? ' checked' : '';
        return `<input name="${name}" type="${type}" value="${value}"${extra} />`;
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

    function getTracesForm() {
        var html = '<table>';
        html += '<tr><th>Column</th><th>X</th><th>Y</th><th>Y2</th><th>Axis type</td></tr>';
        for (const [name, type] of Object.entries(columns)) {
            html += '<tr>' + td(name);
            html += td(getInput('x', 'radio', name, name==params.x));
            if (type == 'numeric') {
                html += td(getInput('y', 'checkbox', name, params.y.includes(name)));
                html += td(getInput('y2', 'checkbox', name, params.y2.includes(name)));
            } else {
                html += '<td></td><td></td>';
            }
            html += td(typeName(type)) + '</tr>';
        }
        html += '</table>';
        return html;
    }

    function getConfigForm() {
        var html = '<table><tr>';
        html += '<td><label>' + getInput('type', 'radio', 'line', params.type=='line') + ' Line</label></td>';
        html += '<td><label>' + getInput('type', 'radio', 'scatter', params.type=='scatter') + ' Scatter</label></td>';
        html += '<td><label>' + getInput('type', 'radio', 'area', params.type=='area') + ' Area</label></td>';
        html += '<td><label>' + getInput('type', 'radio', 'bar', params.type=='bar') + ' Bar</label></td>';
        html += '<td><label>' + getInput('type', 'radio', 'pie', params.type=='pie') + ' Pie</label></td>';
        html += '<td><label>' + getInput('stack', 'checkbox', '1', params.stack) + ' Stacked</label></td>';
        html += '<td><label>' + getInput('categorical_x', 'checkbox', '1', params.categorical_x) + ' Categorical X</label></td>';
        //html += '<td><label>' + getInput('agg', 'checkbox', '1', params.agg) + ' Aggregate</label></td>';
        html += '</tr></table>';
        return html;
    }

    function getColumns(data) {

        //dodać typu null i obsługę wartości null

        const columns = {};
        for (const row of data) {
            for (const [key, val] of Object.entries(row)) {
                const valType = typeof val;
                if (key in columns) {
                    if (columns[key] == 'time') {
                        if ((valType != 'string') || (!dayjs(val).isValid())) {
                            columns[key] = 'categorical';
                        }
                    } else if ((columns[key] == 'numeric') && (valType != 'number')) {
                        columns[key] = 'categorical';
                    }
                } else {
                    if (valType == 'number') {
                        columns[key] = 'numeric';
                    } else if (dayjs(val).isValid()) {
                        columns[key] = 'time';
                    } else {
                        columns[key] = 'categorical';
                    }
                }
            }
        }
        return columns;
    }

    function isStackable() {
        return (params.type == 'bar') && ((params.y.length > 1) || (params.y2.length > 1));
    }

    function getContent() {
        const classes = [];
        if (isStackable()) {
            classes.push('stackable');
        }
        var html = '<div id="plotly-left">';
        html += '<form id="plotly-traces">' + getTracesForm() + '</form>';
        html += '</div>';
        html += '<div id="plotly-right">';
        html += `<form id="plotly-config" data-type="${params.type}"`;
        if (classes.length > 0) {
            html += ' class="' + classes.join(' ') + '"';
        }
        html += '>';
        html += getConfigForm() + '</form>';
        html += '<div id="plotly-chart"></div></div>';
        return html;
    }

    function oneInRow(event) {
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
        for (const par of ['x', 'y', 'y2', 's', 'a']) {
            hashParams.delete(`plt.${par}`);
        }
        if (params.x > '') {
            hashParams.set('plt.x', params.x);
        }
        for (const par of ['y', 'y2']) {
            params[par].forEach(col => hashParams.append(`plt.${par}`, col));
        }
        if (params.type != 'line') {
            hashParams.set('plt.t', params.type);
        }
        if (params.stack) {
            hashParams.set('plt.s', 1);
        }
        if (params.abs) {
            hashParams.set('plt.a', 1);
        }
        const hashStr = hashParams.toString();
        window.location.hash = hashStr;
    }

    function addEventListeners() {
        const tracesForm = document.getElementById('plotly-traces');
        const tracesFormInputs = tracesForm.querySelectorAll('tr input');
        for (const input of tracesFormInputs) {
            input.addEventListener('change', oneInRow);
        }
        const configForm = document.getElementById('plotly-config');
        for (form of [tracesForm, configForm]) {
            form.addEventListener('change', (event) => {
                updateParamsFromForms();
                configForm.dataset.type = params.type;
                configForm.classList.toggle('stackable', isStackable());
                updateUrl();
                updateLinks();
                updateChart();
            });
        }
    }

    function addObserver() {
        let timer;
        let observer = new ResizeObserver((entries) => {
            clearTimeout(timer);
            timer = setTimeout(function() {
                if (plot != null) {
                    Plotly.Plots.resize('plotly-chart');
                }
            }, 500);
        });
        let graphDiv = document.getElementById('plotly-chart');
        observer.observe(graphDiv, {attributes: true});
    }

    function chartMessage(text) {
        const node = document.getElementById('plotly-chart');
        node.innerHTML = text;
    }

    function validateParams() {
        if (params.x == '') {
            return false;
        }
        if (params.type.includes('pie')) {
            return (params.y.length == 1) && (params.y2.length == 0);
        }
        /*
        if (params.type == 'ohlc') {
            return (params.o > '') && (params.h > '') && (params.l > '') && (params.c > '');
        }
        */
        return (params.y.length > 0) || (params.y2.length > 0);
    }

    function getSortedData(sortKey) {
        return [...cachedData].sort((a, b) => a[params.x] - b[params.x]);
    }

    function aggregatedData(xCol, yCols) {
        const agg = {};
        for (const row of cachedData) {
            const x = row[xCol];
            let obj = agg[x];
            if (obj == null) {
                obj = Object.fromEntries(yCols.map(col => [col, 0]));
                obj[xCol] = x;
                agg[x] = obj;
            }
            for (const col of yCols) {
                obj[col] += row[col] || 0;
            }
        }
        return Object.values(agg);
    }

    function pieData(labelCol, valueCol, aggregate) {
        const aggregated = cachedData.reduce((acc, item) => {
            const label = item[labelCol];
            const value = Math.abs(item[valueCol] || 0);
            if (!acc[label]) {
                acc[label] = 0;
            }
            acc[label] += value;
            return acc;
        }, {});
        return {
            labels: Object.keys(aggregated),
            values: Object.values(aggregated)
        }
    }

    function updateChart() {
        if (!validateParams()) {
            plot = null;
            chartMessage(help[params.type]);
            return;
        }
        var layout = {
            //autosize: true,
            title: {automargin: true},
            showlegend: true,
            legend: {orientation: 'h'},
            margin: {autoexpand: true, b: 20, l: 20, r: 20, t: 20}
        };
        const traces = [];
        if (params.type == 'pie') {
            let valCol = params.y[0];
            let data = aggregatedData(params.x, [valCol]);
            data = data.filter((item) => item[valCol] > 0)
            traces.push({
                type: 'pie',
                rotation: 270,
                direction: 'clockwise',
                labels: data.map(row => row[params.x]),
                values: data.map(row => row[valCol]),
                textinfo: 'label+percent',
                textposition: 'outside'
            });
            layout.showlegend = false;
        /*
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
        */
        } else {
            let data = cachedData;
            /*
            if (params.type != 'scatter') {
                data = aggregatedData(params.x, params.y.concat(params.y2));
            } else {
                // is it necessary?
                data = (columns[params.x] == 'label') ? cachedData : getSortedData();
            }
            */
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
            if (params.type == 'area') {
                for (trace of traces) {
                    trace.fill = 'tozeroy';
                    trace.mode = 'none';
                    if (params.type.includes('stack')) {
                        trace.stackgroup = 'one';
                    }
                }
            } else if (params.type == 'bar') {
                let offsetgroup = 0;
                for (trace of traces) {
                    trace.type = 'bar';
                    // https://community.plotly.com/t/barchart-with-bars-behind-each-other-with-multiple-axes/42082
                    if (!params.stack) {
                        trace.offsetgroup = offsetgroup++;
                    }
                }
                if (params.stack) {
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
            if (params.y2.length > 0) {
                layout.yaxis2 = {automargin: 'width', side: 'right', overlaying: 'y'};
            }
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
        const form = document.getElementById('plotly-traces');
        return Math.max(form.offsetHeight+10, 300);
    }

    async function initialize() {
        const panel = document.getElementById('plotly-panel');
        if (panel != null) {
            await fetchData();
            loadParamsFromUrl();
            panel.innerHTML = getContent();
            panel.style.minHeight = getMinHeight()+'px';
            addEventListeners();
            addObserver();
            updateChart();
        }
    }

    // Public API
    return {
        initialize: initialize
    }
})();

document.addEventListener('datasette_init', PlotlyPlugin.initialize);
