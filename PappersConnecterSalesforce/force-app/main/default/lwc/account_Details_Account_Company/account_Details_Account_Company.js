import { LightningElement, track, api } from 'lwc';
import ChartJS from '@salesforce/resourceUrl/ChartJS';
import { loadScript } from 'lightning/platformResourceLoader';
import getFinancialStatements from '@salesforce/apex/FinancialStatementController.getFinancialStatements';

export default class Account_Details_Account_Company extends LightningElement {
    @api recordId; // Record ID passé par le composant parent (par exemple, Account ID)
    @track companyFinancials = [];
    @track years = [];
    @track isChartJsInitialized = false;

    renderedCallback() {
        if (this.isChartJsInitialized) {
            return;
        }
        this.isChartJsInitialized = true;
        loadScript(this, ChartJS)
            .then(() => {
                console.log('Chart.js chargé avec succès');
                if (this.companyFinancials.length > 0) {
                    this.initFinancialData();
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement de Chart.js', error);
            });
    }

    connectedCallback() {
        // Utiliser le recordId pour récupérer les données financières associées
    
        console.log('recordId: ' + this.recordId );
        getFinancialStatements({ accountId: this.recordId })
            .then(data => {
                let financials = [];
                let years = [];

                // Traiter les données renvoyées par Salesforce
                data.forEach(record => {
                    const financialData = {
                        annee: record.Annee__c,
                        chiffre_affaires: record.chiffre_affaires__c,
                        marge_brute: record.Marge_brute__c,
                        ebitda: record.EBITDA_EBE__c,
                        resultat_exploitation: record.Resultat_dexploitation__c,
                        resultat_net: record.Resultat_net__c,
                        taux_croissance_ca: record.Taux_de_croissance_du_CA__c,
                        taux_marge_brute: record.Taux_de_marge_brute__c,
                        taux_marge_ebitda: record.Taux_de_marge_dEBITDA__c,
                        taux_marge_operationnelle: record.Taux_de_marge_oprationnelle__c,
                        bfr: record.BFR__c,
                        bfr_exploitation: record.BFR_exploitation__c,
                        bfr_hors_exploitation: record.BFR_hors_exploitation__c,
                        bfr_j_de_ca: record.BFR_j_de_CA__c,
                        capacite_autofinancement: record.Capacite_dautofinancement__c,
                        fonds_roulement_net_global: record.Fonds_de_roulement_net_global__c,
                        tresorerie: record.Trsorerie__c,
                        dettes_financieres: record.Dettes_financires__c,
                        capacite_remboursement: record.Capacit_de_remboursement__c,
                        ratio_endettement: record.Ratio_dendettement_Gearing__c,
                        autonomie_financiere: record.Autonomie_financiere__c,
                        etat_dettes_1_an_au_plus: record.tat_des_dettes_1_an_au_plus__c,
                        liquidite_generale: record.Liquidit_generale__c,
                        couverture_dettes: record.Couverture_des_dettes__c,
                        fonds_propres: record.Fonds_propres__c,
                        marge_nette: record.Marge_nette__c,
                        rentabilite_fonds_propres: record.Rentabilit_sur_fonds_propres__c,
                        rentabilite_economique: record.Rentabilite_economique__c,
                        valeur_ajoutee: record.Valeur_ajoutee__c,
                        salaires_charges_sociales: record.Salaires_et_charges_sociales__c,
                        salaires_CA: record.Salaires_CA__c,
                        impots_taxes: record.Impots_et_taxes__c
                    };
                    financials.push(financialData);
                    years.push(record.Annee__c);
                });

                this.companyFinancials = financials;
                this.years = years.sort((a, b) => b - a);

                if (this.isChartJsInitialized) {
                    this.initFinancialData();
                }
            })
            .catch(error => {
                console.error('Erreur lors de la récupération des données financières :', error);
            });
    }

    get performanceRows() {
        return this.prepareRows(["chiffre_affaires", "marge_brute", "ebitda", "resultat_exploitation", "resultat_net"]);
    }

    get growthRows() {
        return this.prepareRows(["taux_croissance_ca", "taux_marge_brute", "taux_marge_ebitda", "taux_marge_operationnelle"]);
    }

    get bfrRows() {
        return this.prepareRows(["bfr", "bfr_exploitation", "bfr_hors_exploitation", "bfr_j_de_ca"]);
    }

    get autonomyRows() {
        return this.prepareRows(["capacite_autofinancement", "fonds_roulement_net_global", "tresorerie", "dettes_financieres", "capacite_remboursement", "ratio_endettement", "autonomie_financiere"]);
    }

    get solvencyRows() {
        return this.prepareRows(["etat_dettes_1_an_au_plus", "liquidite_generale", "couverture_dettes", "fonds_propres"]);
    }

    get profitabilityRows() {
        return this.prepareRows(["marge_nette", "rentabilite_fonds_propres", "rentabilite_economique", "valeur_ajoutee"]);
    }

    get activityStructureRows() {
        return this.prepareRows(["salaires_charges_sociales", "salaires_CA", "impots_taxes"]);
    }

    // Prepare rows for each financial field grouping
    prepareRows(fields) {
        return fields.map(fieldKey => ({
            key: fieldKey,
            label: this.getFieldLabel(fieldKey),
            values: this.years.map(year => {
                const financialData = this.companyFinancials.find(entry => entry.annee === year);
                const value = financialData ? financialData[fieldKey] : 'N/A';
                return {
                    year: year,
                    amount: value !== undefined ? this.formatValue(value) : 'N/A'
                };
            })
        }));
    }

    getFieldLabel(fieldKey) {
        const fieldMapping = {
            "chiffre_affaires": "Chiffre d'affaires (€)",
            "marge_brute": "Marge brute (€)",
            "ebitda": "EBITDA - EBE (€)",
            "resultat_exploitation": "Résultat d'exploitation (€)",
            "resultat_net": "Résultat net (€)",
            "taux_croissance_ca": "Taux de croissance du CA (%)",
            "taux_marge_brute": "Taux de marge brute (%)",
            "taux_marge_ebitda": "Taux de marge d'EBITDA (%)",
            "taux_marge_operationnelle": "Taux de marge opérationnelle (%)",
            "bfr": "BFR (€)",
            "bfr_exploitation": "BFR exploitation (€)",
            "bfr_hors_exploitation": "BFR hors exploitation (€)",
            "bfr_j_de_ca": "BFR (j de CA)",
            "capacite_autofinancement": "Capacité d'autofinancement (€)",
            "fonds_roulement_net_global": "Fonds de roulement net global (€)",
            "tresorerie": "Trésorerie (€)",
            "dettes_financieres": "Dettes financières (€)",
            "capacite_remboursement": "Capacité de remboursement",
            "ratio_endettement": "Ratio d'endettement (Gearing)",
            "autonomie_financiere": "Autonomie financière (%)",
            "etat_dettes_1_an_au_plus": "État des dettes à 1 an au plus (€)",
            "liquidite_generale": "Liquidité générale",
            "couverture_dettes": "Couverture des dettes",
            "fonds_propres": "Fonds propres (€)",
            "marge_nette": "Marge nette (%)",
            "rentabilite_fonds_propres": "Rentabilité sur fonds propres (%)",
            "rentabilite_economique": "Rentabilité économique (%)",
            "valeur_ajoutee": "Valeur ajoutée (€)",
            "salaires_charges_sociales": "Salaires et charges sociales (€)",
            "salaires_CA": "Salaires / CA (%)",
            "impots_taxes": "Impôts et taxes (€)"
        };
        return fieldMapping[fieldKey] || fieldKey;
    }

    initializePieChart() {
        const ctx = this.template.querySelector('canvas').getContext('2d');
        new window.Chart(ctx, {
        type: 'line',
        data: {
        labels: ['Website Forms', 'Social Media ', 'Email Marketing Campaigns', 'Referrals', 'Partner Channels', 'Networking'],
        datasets: [{
        label: '# of Votes',
        data: [12, 19, 3, 5, 2, 3],
        backgroundColor: [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)',
        'rgba(255, 159, 64, 0.5)'
        ]
        }]
        },
        options: {
        responsive: true,
        maintainAspectRatio: false,
        title: {
        display: true,
        text: "Lead Sources"
        }
        },
        });
        }
        
	initFinancialData() {
        if (this.companyFinancials.length > 0) {
            // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
            requestAnimationFrame(() => {
                this.renderFinancialChart();
            });
        } else {
            console.warn('Les données financières ne sont pas prêtes');
        }
    }
    formatValue(value) {
        if (typeof value === 'number') {
            if (value >= 1e6) {
                return (value / 1e6).toFixed(1) + 'M€';
            } else if (value >= 1e3) {
                return (value / 1e3).toFixed(1) + 'K€';
            }
        }
        return value;
    }

    renderFinancialChart() {
        const canvas = this.template.querySelector("canvas");
        if (!canvas) {
            console.error('Le canvas pour le graphe n\'a pas été trouvé');
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error('Impossible d\'obtenir le contexte 2D du canvas');
            return;
        }

        if (this.chart) {
            // Supprimer l'ancien graphe s'il existe
            this.chart.destroy();
        }

        // Créer un nouveau graphe avec les données financières récupérées
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.companyFinancials.map(financial => financial.annee),
                datasets: [
                    {
                        label: "Chiffre d'affaires (€)",
                        data: this.companyFinancials.map(financial => financial.chiffre_affaires),
                        borderColor: "#007bff",
                        backgroundColor: "rgba(0, 123, 255, 0.1)",
                        fill: true,
                        pointBorderColor: "#007bff",
                        pointBackgroundColor: "#fff",
                        pointRadius: 5,
                        borderWidth: 2,
                        hidden: true
                    },
                    {
                        label: "Résultat net (€)",
                        data: this.companyFinancials.map(financial => financial.resultat_net),
                        borderColor: "#28a745",
                        backgroundColor: "rgba(40, 167, 69, 0.1)",
                        fill: true,
                        pointBorderColor: "#28a745",
                        pointBackgroundColor: "#fff",
                        pointRadius: 5,
                        borderWidth: 2,
                        hidden: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Valeur (€)'
                        }
                    },
                    ticks: {
                        // Format y-axis ticks
                        callback: function(value) {
                            if (value >= 1e6) {
                                // Convert to millions and append M€
                                return (value / 1e6).toFixed('1') + ' M€';
                            } else if (value >= 1e3) {
                                // Convert to thousands and append k€
                                return (value / 1e3).toFixed('1') + ' k€';
                            }
                            // Show plain value for smaller numbers
                            return value.toFixed('0') + ' €';
                        }
                    },
                
                    x: {
                        title: {
                            display: true,
                            text: 'Année'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }
   /* renderChart() {
        const canvas = this.template.querySelector("#financialChart");
        if (!canvas) {
            console.error('Le canvas pour le graphe n\'a pas été trouvé');
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error('Impossible d\'obtenir le contexte 2D du canvas');
            return;
        }

        if (this.chart) {
            // Supprimer l'ancien graphe s'il existe
            this.chart.destroy();
        }

        // Créer un nouveau graphe
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.years,
                datasets: [{
                    label: "Chiffre d'affaires (€)",
                    data: this.companyFinancials.map(financial => financial.ratios?.chiffre_affaires || 0),
                    borderColor: "#007bff",
                    backgroundColor: "rgba(0, 123, 255, 0.1)",
                    fill: true,
                    pointBorderColor: "#007bff",
                    pointBackgroundColor: "#fff",
                    pointRadius: 5,
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Chiffre d\'affaires (€)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Année'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }*/
}