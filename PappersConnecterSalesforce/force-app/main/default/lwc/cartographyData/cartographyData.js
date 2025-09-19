import { LightningElement, wire, track } from 'lwc';
import getCartography from '@salesforce/apex/CartographyController.getCartography';
import d3Resource from '@salesforce/resourceUrl/d3';
import { loadScript } from 'lightning/platformResourceLoader';
import { CurrentPageReference } from 'lightning/navigation';

export default class CartographyData extends LightningElement {
    @track accountId; // Account ID passed to the component
    cartographyData; // Data fetched from Apex
    d3Initialized = false; // Ensure D3.js is loaded only once
    error;
    @track isFullScreen = false; // Suivre l'état du mode plein écran
    @track expandIcon = 'utility:expand';




    connectedCallback() {
        this.fetchCartographyData();
        window.addEventListener('keydown', this.handleKeyPress.bind(this));
    }

    disconnectedCallback() {
        // Supprimer l'écouteur lorsque le composant est déconnecté
        window.removeEventListener('keydown', this.handleKeyPress.bind(this));
    }

    // Gérer la touche ESC pour quitter le mode plein écran
    handleKeyPress(event) {
        if (event.key === 'Escape' && this.isFullScreen) {
            this.exitFullScreen();
        }
    }

    // Basculer entre le mode plein écran simulé et le mode normal
    toggleExpand() {
        if (!this.isFullScreen) {
            this.enterFullScreen();
        } else {
            this.exitFullScreen();
        }
    }

    // Activer le mode plein écran simulé
    enterFullScreen() {
        const graphContainer = this.template.querySelector('.graph-container');

        graphContainer.classList.add('fullscreen'); // Ajouter la classe CSS
        this.isFullScreen = true;
        this.expandIcon = 'utility:contract'; // Changer l'icône pour "réduire"
            // Ensure the graph resizes properly
    setTimeout(() => {
        this.updateGraphDimensions();
    }, 100); 
    }

    // Désactiver le mode plein écran simulé
    exitFullScreen() {
        const graphContainer = this.template.querySelector('.graph-container');

        graphContainer.classList.remove('fullscreen'); // Supprimer la classe CSS
        this.isFullScreen = false;
        this.expandIcon = 'utility:expand'; // Changer l'icône pour "agrandir"
            // Ensure the graph resizes properly
    setTimeout(() => {
        this.updateGraphDimensions();
    }, 100); 
    }
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef && pageRef.attributes) {
            this.accountId = pageRef.attributes.recordId;
            console.log('Extracted recordId in CartographyData:', this.accountId);
        }
    }

    renderedCallback() {
        if (this.d3Initialized) {
            return;
        }

        loadScript(this, d3Resource)
            .then(() => {
                console.log('D3.js loaded successfully');
                this.d3Initialized = true;

                if (this.cartographyData) {
                    this.renderGraph();
                }
            })
            .catch((error) => {
                console.error('Error loading D3.js:', error);
                this.error = error;
            });
    }
    updateGraphDimensions() {
        const graphContainer = this.template.querySelector('.graph-container');
        if (!graphContainer) return;
    
        const width = graphContainer.clientWidth;
        const height = graphContainer.clientHeight;
    
        const svg = d3.select(graphContainer).select('svg');
        if (!svg.empty()) {
            svg.attr('width', width).attr('height', height);
        }
        
        // Restart simulation with new dimensions
        this.renderGraph();
    }
    fetchCartographyData() {
        console.log('recordId: ' + this.accountId);
        getCartography({ accountId: this.accountId })
            .then((data) => {
                console.log('Cartography data fetched:', data);
                this.cartographyData = data;

                if (this.d3Initialized) {
                    this.renderGraph();
                }
            })
            .catch((error) => {
                console.error('Error fetching cartography data:', error);
                this.error = error;
            });
    }

    renderGraph() {
        if (!this.cartographyData) {
            console.error('No cartography data available to render');
            return;
        }

        const { centralNode, entreprises, liens_entreprises_entreprises } = this.cartographyData;

        if (!centralNode || !entreprises || !liens_entreprises_entreprises) {
            console.error('Invalid cartography data structure:', this.cartographyData);
            return;
        }

        const nodes = [centralNode, ...entreprises];
        const validNodeIds = new Set(nodes.map((n) => n.id));
        const links = liens_entreprises_entreprises
            .filter(([source, target]) => validNodeIds.has(source) && validNodeIds.has(target))
            .map(([source, target]) => ({ source, target }));

        const graphContainer = this.template.querySelector('.graph-container');
        d3.select(graphContainer).selectAll('*').remove();

        const width = graphContainer.clientWidth || 800;
        const height = graphContainer.clientHeight || 600;

        // SVG container
        const svg = d3
            .select(graphContainer)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const svgGroup = svg.append('g');

        const simulation = d3
            .forceSimulation(nodes)
            .force(
                'link',
                d3.forceLink(links).id((d) => d.id).distance((d) => 150 + nodes.length * 5) // Dynamic distance
            )
            .force('charge', d3.forceManyBody().strength(-500 - nodes.length * 5)) // Adjusted repulsion
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide(50)); // Prevent overlap

        // Draw links
        const link = svgGroup
            .append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke-width', 1.5)
            .attr('stroke', '#ccc');

        // Draw nodes
        const node = svgGroup
            .append('g')
            .selectAll('circle')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('r', (d) => (d.id === centralNode.id ? 30 : 15)) // Central node larger
            .attr('fill', (d) => (d.id === centralNode.id ? '#ff6600' : '#4682b4'))
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                if (d.id) {
                    window.open(`/lightning/r/Cartography__c/${d.id}/view`, '_blank');
                }
            })
            .call(
                d3
                    .drag()
                    .on('start', (event, d) => {
                        if (!event.active) simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on('drag', (event, d) => {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on('end', (event, d) => {
                        if (!event.active) simulation.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    })
            );

        // Draw labels
        const label = svgGroup
            .append('g')
            .selectAll('text')
            .data(nodes)
            .enter()
            .append('text')
            .text((d) => d.name)
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .attr('text-anchor', 'middle')
            .attr('dy', -20);

        // Adjust zoom dynamically to fit all nodes
        const zoom = d3.zoom().on('zoom', (event) => svgGroup.attr('transform', event.transform));
        svg.call(zoom);

        simulation.on('end', () => {
            const bounds = svgGroup.node().getBBox();
            const scale = Math.min(width / bounds.width, height / bounds.height) * 0.9; // Adjust scaling factor
            const translate = [
                width / 2 - (bounds.x + bounds.width / 2) * scale,
                height / 2 - (bounds.y + bounds.height / 2) * scale,
            ];
            svg.transition()
                .duration(250)
                .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
        });

        simulation.nodes(nodes).on('tick', () => {
            link
                .attr('x1', (d) => d.source.x)
                .attr('y1', (d) => d.source.y)
                .attr('x2', (d) => d.target.x)
                .attr('y2', (d) => d.target.y);

            node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);

            label.attr('x', (d) => d.x).attr('y', (d) => d.y - 25); // Adjusted position above nodes
        });

        simulation.force('link').links(links);
    }
}