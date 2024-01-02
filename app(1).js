"use strict";
var CM;
(function (CM) {
    CM.ExpandableActions = {
        expand(e) {
            e.target.closest('.expandable').classList.add('expanded');
        }
    };
    CM.StatsActions = {
        show(e) {
            document.querySelector('.tab.current').classList.remove('current');
            e.target.classList.add('current');
            Chart.graph.series[0].data = Chart.data[e.id];
            Chart.graph.render();
        }
    };
    class Chart {
        static async show(period, interval) {
            let statsContentEl = document.getElementById('statsContent');
            statsContentEl.classList.add('loading');
            document.querySelector('.hitsTab').classList.remove('current');
            document.querySelector('.visitorsTab').classList.add('current');
            let url = `/stats/chart?period=${period}&interval=${interval}`;
            let html = await _.getHTML(url);
            statsContentEl.classList.remove('loading');
            statsContentEl.innerHTML = html;
            Carbon.DOM.onChange();
            return true;
        }
    }
    CM.Chart = Chart;
    CM.ChartActions = {
        setup(e) {
            let target = e.target;
            let data = JSON.parse(target.querySelector('script').textContent);
            let graph = new Rickshaw.Graph({
                element: target,
                renderer: 'line2',
                width: 960,
                height: 200,
                interpolation: 'linear',
                series: [
                    {
                        data: data.visitors,
                        color: '#AA7FF0'
                    }
                ]
            });
            let x_axis = new Rickshaw.Graph.Axis.X({
                graph: graph,
                tickFormat: n => data.dates[n],
                orientation: 'bottom',
                width: 960,
                element: document.getElementById('x_axis')
            });
            new Rickshaw.Graph.HoverDetail({
                graph: graph,
                formatter(series, x, y) {
                    return `<span class="date">${data.dates[x]}</span>
    <span class="value">${d3.format("0.2s")(y).toUpperCase().replace('.0', '')}</span>
    <span class="weekday">${data.days[x].substring(0, 2)}</span>`;
                }
            });
            graph.render();
            let { clientCount, hitCount } = target.dataset;
            document.querySelector('.visitorsTab .count').textContent = clientCount;
            document.querySelector('.hitsTab .count').textContent = hitCount;
            Chart.data = data;
            Chart.graph = graph;
        },
        changeView(e) {
            let { duration, interval } = e.target.dataset;
            Array.from(document.querySelectorAll('.active')).forEach(el => {
                el.classList.remove('active');
            });
            e.target.classList.add('active');
            Chart.show(duration, interval);
        },
        changePeriod() {
            Chart.show('P30D', 'P1D');
        }
    };
})(CM || (CM = {}));
