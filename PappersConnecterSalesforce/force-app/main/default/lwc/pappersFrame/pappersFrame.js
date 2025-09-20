import { LightningElement, track, api } from 'lwc';
import checkAccountsBySiret from '@salesforce/apex/AccountChecker.checkAccountsBySiret';
import createAccountWithFinancials from '@salesforce/apex/AccountChecker.createAccountWithFinancials';
import getAccountIdBySiret from '@salesforce/apex/AccountChecker.getAccountIdBySiret';
import handleCartographyData from '@salesforce/apex/AccountChecker.handleCartographyData';
import getParentAccountBySiret from '@salesforce/apex/AccountChecker.getParentAccountBySiret';
import updateFinancialStatements from '@salesforce/apex/FinancialStatementController.updateFinancialStatements';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import API_Key_Pappers from '@salesforce/label/c.API_Key_Pappers'; 
import Par_page from '@salesforce/label/c.Par_page'; 

export default class PappersFrame extends NavigationMixin(LightningElement) {
    @api label = 'Rechercher une entreprise';
    @track values = [];
    @track companyDetails;
    @track financialData = [];
    @track cartographyData=[];
    @track years=[];
    suggestionsMap = new Map();
    @track query='';
    @track currentFilter = 'name';
    @track filters = [
        { label: 'Nom, SIREN, SIRET', value: 'name' },
        { label: 'Adresse', value: 'address' }
    ];
    @track autocompleteValues = [];
    debounceTimeout;
    @track selectedEstablishment = null;
    @track mapMarkers = [];
    @track selectedMarkerValue = null;
    @api recordId;

    connectedCallback() {
        console.log('RecordId reçu du lead :', this.recordId);
        // Ajoutez ici des actions basées sur le recordId, comme appeler une méthode Apex
        console.log('Clé API Pappers récupérée :', API_Key_Pappers);
    }
    handleInputChange(event) {
        this.query = event.target.value.trim();
        if (this.query.length > 2) {
            if (this.currentFilter === 'name') {
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = setTimeout(() => {
                    this.fetchNameSuggestions(this.query);
                }, 300);
            } else if (this.currentFilter === 'address') {
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = setTimeout(() => {
                    this.fetchAddressAutocomplete(this.query);
                }, 300);
            }
        } else {
            this.values = [];
            this.autocompleteValues = [];
        }
    }

    changeFilter(event) {
        const selectedFilter = event.detail.value;
        if (selectedFilter !== this.currentFilter) {
            this.currentFilter = selectedFilter;
            this.query = ''; // Reset query when filter changes
            this.values = []; // Clear current suggestions
            this.suggestionsMap.clear(); // Clear the suggestions map
            this.autocompleteValues = [];
            this.template.querySelector('.search-input').value = ''; // Reset input field
        }
        console.log('Filter switched to:', this.currentFilter);
    }
    async fetchAddressAutocomplete(query) {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            // Map autocomplete results
            this.autocompleteValues = data.features.map((feature, index) => ({
                key: index,
                value: feature.properties.label,
                label: feature.properties.label,
            }));
    
            // If the typed query is not in the autocomplete values, add it
            const isQueryPresent = this.autocompleteValues.some(
                (address) => address.label.toLowerCase() === query.toLowerCase()
            );
    
            if (!isQueryPresent) {
                this.autocompleteValues.unshift({
                    key: 'typed-query',
                    value: query,
                    label: query, // Display the typed address
                });
            }
    
            console.log('Address autocomplete values:', this.autocompleteValues);
        } catch (error) {
            console.error('Error fetching address autocomplete:', error);
        }
    }
    
    fetchNameSuggestions(query) {
        this.getSuggestions(query)
        .then(data => {
            console.log('Suggestions fetched:', data);
            this.suggestionsMap = new Map();
            // Combine results from all available fields
            const combinedResults = [
                ...(data.resultats_nom_entreprise || []),
                ...(data.resultats_siren || []),
                ...(data.resultats_siret || []),
            ];
             // Supprimer les doublons basés sur le SIRET ou SIREN
             const uniqueResults = [];
             const seenKeys = new Set();

             combinedResults.forEach((item) => {
                const uniqueKey = item.siren || item.siege?.siret;
                if (uniqueKey && !seenKeys.has(uniqueKey)) {
                    seenKeys.add(uniqueKey);
                    uniqueResults.push(item);
                }
            });

            const suggestions = uniqueResults.map((item, index) => {
                const isSirenMatch = item.siren === query;
                const isSiretMatch = item.siege?.siret === query;
                let paddedName = `${item.nom_entreprise}${item.siege && item.siege.code_postal ? ' (' + item.siege.code_postal + ')' : ''} ${item.libelle_code_naf}`;
                this.suggestionsMap.set(paddedName, item);
                return { key: index, value: paddedName, siret: item.siege.siret,siren:item.siren };
            });
            // Display suggestions, prioritizing SIREN or SIRET matches at the top
            this.values = suggestions.sort((a, b) => {
                if (b.isSirenMatch || b.isSiretMatch) return 1;
                if (a.isSirenMatch || a.isSiretMatch) return -1;
                return 0;
            });

            
            const siretList = suggestions.map(suggestion => suggestion.siret);
            checkAccountsBySiret({ sirets: siretList })
                .then(result => {
                    console.log('Account existence check result:', result);
                    this.values = suggestions.map(suggestion => ({
                        ...suggestion,
                        existsInAccount: result.hasOwnProperty(String(suggestion.siret)) && result[String(suggestion.siret)] === true
                    }));
                    console.log('Final values for display:', this.values);
                })
                .catch(error => console.error('Erreur lors de la vérification de l\'existence du compte :', error));
        })
        .catch(error => console.error('Erreur lors de la récupération des suggestions :', error));
}
get showAddressSuggestions() {
    return this.autocompleteValues.length > 0 && this.currentFilter === 'address';
}
handleEtablissementClick(event) {
    const selectedSiret = event.currentTarget.dataset.siret;
    console.log('Selected établissement SIRET:', selectedSiret);

    if (!selectedSiret) {
        console.warn('No SIRET provided.');
        return;
    }

    // Clear suggestions and autocomplete values
    this.values = [];
    this.autocompleteValues = [];

    // Fetch company details based on the selected SIRET
    this.getCompanyDetails(selectedSiret, false)
        .then(details => {
            if (details) {
                this.companyDetails = details; // Update the company details for display

                // Find the selected establishment within the fetched company details
                const selectedEstablishment = details.etablissement;

                if (selectedEstablishment) {
                    console.log('Selected establishment:', selectedEstablishment);

                    // Check if the establishment exists in Salesforce
                    checkAccountsBySiret({ sirets: [selectedSiret] })
                        .then(existingAccounts => {
                            const existsInSalesforce = !!existingAccounts[selectedSiret];
                            console.log(`Establishment exists in Salesforce: ${existsInSalesforce}`);

                            // Add existsInSalesforce property to the selected establishment
                            selectedEstablishment.existsInSalesforce = existsInSalesforce;

                            // Update the selected establishment details
                            this.selectedEstablishment = selectedEstablishment;

                            // Set map markers dynamically
                            this.mapMarkers = [
                                {
                                    location: {
                                        Latitude: selectedEstablishment.latitude,
                                        Longitude: selectedEstablishment.longitude,
                                    },
                                    title: `${selectedEstablishment.adresse_ligne_1}, ${selectedEstablishment.ville}`,
                                    description: `SIRET: ${selectedEstablishment.siret_formate}`,
                                },
                            ];
                            this.selectedMarkerValue = selectedEstablishment.siret_formate; // Highlight the selected marker

                            // Trigger UI update for button
                            this.template.querySelector('.action-buttons').refresh();
                        })
                        .catch(error => {
                            console.error('Error checking account in Salesforce:', error);
                        });
                } else {
                    console.warn('No establishment found with the selected SIRET.');
                }
            } else {
                console.warn('No details found for the selected établissement.');
            }
        })
        .catch(error => {
            console.error('Error fetching établissement details:', error);
        });
}


async fetchEstablishments(event) {
    const siren = event.currentTarget.dataset.siren; // Extract SIREN from the clicked item
    console.log('SIREN from event:', siren);

    if (!siren) {
        console.error('SIREN is missing or undefined.');
        return;
    }

    const selectedCompany = this.values.find(company => company.siren === siren);

    if (!selectedCompany) {
        console.error('No company found with SIREN:', siren);
        return;
    }

    if (!selectedCompany.etablissements) {
        this.isLoading = true;
        const url = `https://api.pappers.fr/v2/entreprise?siren=${siren}&api_token=${API_Key_Pappers}`;
        console.log('url',url);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch establishments. HTTP status: ' + response.status);
            }
            const data = await response.json();

            if (data.etablissements && Array.isArray(data.etablissements)) {
                const establishments = data.etablissements
                    .filter(establishment => !establishment.etablissement_cesse) // Exclude closed establishments
                    .map(establishment => ({
                        siret: establishment.siret,
                        siret_formate: establishment.siret_formate,
                        adresse_ligne_1: establishment.adresse_ligne_1,
                        ville: establishment.ville,
                        siege: establishment.siege,
                        existsInSalesforce: false, // Default to false initially
                    }));

                // Perform the check for existing accounts in Salesforce
                const sirets = establishments.map(e => e.siret);
                const existingAccounts = await checkAccountsBySiret({ sirets });

                if (existingAccounts) {
                    establishments.forEach(establishment => {
                        establishment.existsInSalesforce = !!existingAccounts[establishment.siret];
                    });
                } else {
                    console.warn('No existing accounts found for the provided SIRETs.');
                }

                selectedCompany.etablissements = establishments;
            } else {
                console.warn('No valid etablissements array found in response.');
                selectedCompany.etablissements = [];
            }

            this.values = this.values.map(company =>
                company.siren === selectedCompany.siren ? { ...selectedCompany } : company
            );
        } catch (error) {
            console.error('Error fetching establishments:', error);
            this.showToast('Error', 'Erreur lors de la récupération des établissements.', 'error');
        } finally {
            this.isLoading = false;
        }
    } else {
        console.log('Establishments already fetched for this company.');
        this.showToast('Info', 'Les établissements ont déjà été récupérés.', 'info');
    }
}




getCompanyDetails(siret) {
    const url = `https://api.pappers.fr/v2/entreprise?siret=${siret}&api_token=${API_Key_Pappers}`;

    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch company details.');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error fetching company details:', error);
            return null;
        });
}

handleAddressSelection(event) {
    const selectedValue = event.currentTarget.dataset.value;
    this.query = selectedValue;
    this.autocompleteValues = []; // Clear suggestions

    this.fetchAddressSuggestions(selectedValue); // Trigger company search by address
}
get placeholder() {
    if (this.currentFilter === 'name') {
        return 'Rechercher par nom, SIREN, ou SIRET...';
    } else if (this.currentFilter === 'address') {
        return 'Rechercher par adresse...';
    }
    return 'Rechercher...'; // Default placeholder
}

fetchAddressSuggestions(query) { 
    const url = `https://api.pappers.fr/v2/recherche?adresse=${encodeURIComponent(query)}&api_token=${API_Key_Pappers}&par_page=${Par_page}`;
    console.log('url',url);
    console.log('Fetching address suggestions for query:', query);

    fetch(url)
        .then((response) => response.json())
        .then((data) => {
            this.suggestionsMap = new Map();

            const suggestions = data.resultats.map((item, index) => {
                const paddedName = `${item.nom_entreprise}${item.siege?.siret ? ' (' + item.siege.siret + ')' : ''}, ${item.siege?.ville || ''}`;
                this.suggestionsMap.set(paddedName, item);
                return {
                    key: index,
                    value: paddedName,
                    siret: item.siege?.siret,
                    etablissements: item.etablissements || [] // Include établissements
                };
            });

            this.values = suggestions;
            console.log('Address suggestions:', this.values);
            const siretList = suggestions.map(suggestion => suggestion.siret);
            checkAccountsBySiret({ sirets: siretList })
                .then(result => {
                    console.log('Account existence check result:', result);
                    this.values = suggestions.map(suggestion => ({
                        ...suggestion,
                        existsInAccount: result.hasOwnProperty(String(suggestion.siret)) && result[String(suggestion.siret)] === true
                    }));
                    console.log('Final values for display:', this.values);
                })
                .catch(error => console.error('Erreur lors de la vérification de l\'existence du compte :', error));
        })
        .catch((error) => console.error('Error fetching address suggestions:', error));
}


 async getSuggestions(query) {
    const url = `https://suggestions.pappers.fr/v2?q=${query}&longueur=10&cibles=nom_entreprise,siren,siret`;
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Échec de la récupération des suggestions');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Erreur lors de la récupération des suggestions :', error);
            return []; // Return an empty array if the request fails
        });
}
/*handleInputChange(evt) {
    const query = evt.target.value.trim();
    this.companyDetails=null;
    if (query.length > 2) {
        console.log('Fetching suggestions for query:', query);

        // Fetch suggestions and populate `values`
        this.getSuggestions(query)
            .then(data => {
                console.log('Suggestions fetched:', data);
                this.suggestionsMap = new Map();
                // Combine results from all available fields
                const combinedResults = [
                    ...(data.resultats_nom_entreprise || []),
                    ...(data.resultats_siren || []),
                    ...(data.resultats_siret || []),
                ];
                 // Supprimer les doublons basés sur le SIRET ou SIREN
                 const uniqueResults = [];
                 const seenKeys = new Set();

                 combinedResults.forEach((item) => {
                    const uniqueKey = item.siren || item.siege?.siret;
                    if (uniqueKey && !seenKeys.has(uniqueKey)) {
                        seenKeys.add(uniqueKey);
                        uniqueResults.push(item);
                    }
                });

                const suggestions = uniqueResults.map((item, index) => {
                    const isSirenMatch = item.siren === query;
                    const isSiretMatch = item.siege?.siret === query;
                    let paddedName = `${item.nom_entreprise}${item.siege && item.siege.code_postal ? ' (' + item.siege.code_postal + ')' : ''} ${item.libelle_code_naf}`;
                    this.suggestionsMap.set(paddedName, item);
                    return { key: index, value: paddedName, siret: item.siege.siret };
                });
                // Display suggestions, prioritizing SIREN or SIRET matches at the top
                this.values = suggestions.sort((a, b) => {
                    if (b.isSirenMatch || b.isSiretMatch) return 1;
                    if (a.isSirenMatch || a.isSiretMatch) return -1;
                    return 0;
                });

                
                const siretList = suggestions.map(suggestion => suggestion.siret);
                checkAccountsBySiret({ sirets: siretList })
                    .then(result => {
                        console.log('Account existence check result:', result);
                        this.values = suggestions.map(suggestion => ({
                            ...suggestion,
                            existsInAccount: result.hasOwnProperty(String(suggestion.siret)) && result[String(suggestion.siret)] === true
                        }));
                        console.log('Final values for display:', this.values);
                    })
                    .catch(error => console.error('Erreur lors de la vérification de l\'existence du compte :', error));
            })
            .catch(error => console.error('Erreur lors de la récupération des suggestions :', error));
    } else {
        this.values = []; // Clear values if the query is too short
    }
}*/
    get rcsUpdate() {
        return this.companyDetails && this.companyDetails.derniere_mise_a_jour_rcs
            ? this.companyDetails.derniere_mise_a_jour_rcs
            : 'Non disponible';
    }

    get inseeUpdate() {
        return this.companyDetails && this.companyDetails.derniere_mise_a_jour_sirene
            ? this.companyDetails.derniere_mise_a_jour_sirene
            : 'Non disponible';
    }

    handleSuggestionClick(evt) {
        evt.stopPropagation();
        const value = evt.currentTarget.dataset.value;
        let selectedItem = this.suggestionsMap.get(value);

        if (selectedItem) {
            console.log('Selected item:', selectedItem);
            this.companyDetails = null;
    
            this.getCompanyDetails(selectedItem.siege.siret,false)
                .then(details => {
                    if (details) {
                        this.companyDetails = details;
                        console.log('Company details fetched:', details);
                    } else {
                        console.warn('No company details found.');
                    }
                })
                .catch(error => {
                    console.error('Error fetching company details:', error);
                });
        } else {
            console.warn('Selected item not found in suggestionsMap');
        }
    
        this.values = []; // Clear suggestions
    }

    getCompanyDetails(siret, includeSupplementaryFields = false) { 
        const apiToken = API_Key_Pappers;
        const supplementaryFields = includeSupplementaryFields ? '&champs_supplementaires=scoring_financier' : '';
        const url = `https://api.pappers.fr/v2/entreprise?siret=${siret}&api_token=${apiToken}${supplementaryFields}`;
        
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Échec de la récupération des détails de l\'entreprise');
                }
                return response.json();
            })
            .catch(error => {
                console.error('Erreur lors de la récupération des détails de l\'entreprise :', error);
                return null;
            });
    }
    

    async getFinancialData(siren) {
        console.log('Checking for financial data in companyDetails...');
        
        const currentYear = new Date().getFullYear();
        const validYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3,currentYear - 4,currentYear - 5]; // Generate last 4 years explicitly
        console.log('Valid years:', validYears);
        if (this.companyDetails?.finances && Array.isArray(this.companyDetails.finances) && this.companyDetails.finances.length > 0) {
            console.log('All financial data:', JSON.stringify(this.companyDetails.finances, null, 2));
        
            const filteredFinancials = this.companyDetails.finances
            .filter((finance) => {
                const year = parseInt(finance.annee, 10);
                const isValidYear = validYears.includes(year);
                console.log(`Checking year: ${year} -> ${isValidYear ? 'Included' : 'Excluded'}`);
                return isValidYear;
            })
            .map((finance) => ({
                    annee: finance.annee,
                    chiffre_affaires: finance.chiffre_affaires || null,
                    marge_brute: finance.marge_brute || null,
                    ebitda: finance.taux_marge_EBITDA || null,
                    resultat_exploitation: finance.resultat_exploitation || null,
                    resultat_net: finance.resultat || null,
                    taux_croissance_ca: finance.taux_croissance_chiffre_affaires || null,
                    taux_marge_brute: finance.taux_marge_brute || null,
                    taux_marge_ebitda: finance.taux_marge_EBITDA || null,
                    taux_marge_operationnelle: finance.taux_marge_operationnelle || null,
                    bfr: finance.BFR || null,
                    bfr_exploitation: finance.BFR_exploitation || null,
                    bfr_hors_exploitation: finance.BFR_hors_exploitation || null,
                    BFR_jours_CA: finance.BFR_jours_CA || null,
                    capacite_autofinancement: finance.capacite_autofinancement || null,
                    fonds_roulement_net_global: finance.fonds_roulement_net_global || null,
                    tresorerie: finance.tresorerie || null,
                    dettes_financieres: finance.dettes_financieres || null,
                    capacite_remboursement: finance.capacite_remboursement || null,
                    ratio_endettement: finance.ratio_endettement || null,
                    autonomie_financiere: finance.autonomie_financiere || null,
                    etat_dettes_1_an_au_plus: finance.etat_dettes_1_an_au_plus || null,
                    liquidite_generale: finance.liquidite_generale || null,
                    couverture_dettes: finance.couverture_dettes || null,
                    fonds_propres: finance.fonds_propres || null,
                    marge_nette: finance.marge_nette || null,
                    rentabilite_fonds_propres: finance.rentabilite_fonds_propres || null,
                    rentabilite_economique: finance.rentabilite_economique || null,
                    valeur_ajoutee: finance.valeur_ajoutee || null,
                    salaires_charges_sociales: finance.salaires_charges_sociales || null,
                    salaires_CA: finance.salaires_CA || null,
                    impots_taxes: finance.impots_taxes || null
                }));
    
                return filteredFinancials; // Ensure the method returns the filtered data
        }
        else {
            console.warn('No financial data found in companyDetails.finances.');
            return []; // Return an empty array if no data is found
        }
    }
    
    
    
    // Method to fetch cartography data using async/await
async getCartographyData(siren) {
    const cleanedSiren = siren.replace(/\s+/g, ''); 
    const apiToken = API_Key_Pappers; // Replace with your actual token
    const url = `https://api.pappers.fr/v2/entreprise/cartographie?siren=${cleanedSiren}&inclure_entreprises_dirigees=true&inclure_entreprises_citees=true&api_token=${apiToken}`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch cartography data');
        }
        
        const data = await response.json();
        // Process the cartography data as needed before returning
        return data;
    } catch (error) {
        console.error('Error fetching cartography data:', error);
        throw error;
    }
}


// Method to create an account and handle cartography data
async handleCreateAccount() {
    console.log('handleCreateAccount() method triggered');

    if (!this.companyDetails) {
        console.warn('Company details are not available');
        return;
    }

    const {
        nom_entreprise,
        siren_formate,
        siege,
        libelle_code_naf,
        effectif_max,
        date_creation,
        etablissements,
        forme_juridique,
        effectif,
        numero_tva_intracommunautaire,
        date_immatriculation_rcs,
        date_immatriculation_rne,
        numero_rcs,
        capital,
        objet_social,
        code_naf,
        forme_exercice,
        conventions_collectives,
        prochaine_date_cloture_exercice,
        scoring_financier,
    } = this.companyDetails;

    try {
        let parentAccountId = null; // To store the parent account ID for linking secondary establishments
        const isSecondaryEstablishment = !!this.selectedEstablishment;

        if (isSecondaryEstablishment && this.selectedEstablishment.siege==false) {
            // Case 1: User selected a secondary establishment
            console.log('Creating account for selected secondary establishment.');

            const secondaryEstablishmentData = {
                name: `${nom_entreprise} ${this.selectedEstablishment.ville}`,
                siret: this.selectedEstablishment.siret,
                siren: siren_formate,
                address: `${this.selectedEstablishment.adresse_ligne_1}, ${this.selectedEstablishment.ville}, ${this.selectedEstablishment.code_postal}, ${this.selectedEstablishment.pays}`,
                activity: this.selectedEstablishment.libelle_code_naf,
                employeeCount: this.selectedEstablishment.effectif,
                creationDate: new Date(this.selectedEstablishment.date_de_creation),
                 
                tranche:this.selectedEstablishment.effectif,
                type: 'Établissement secondaire',
            };

            console.log('Data for secondary establishment creation:', secondaryEstablishmentData);

            // Check if the siege already exists in Salesforce
            const existingSiege = await checkAccountsBySiret({ sirets: [siege.siret] });
            if (existingSiege && existingSiege[siege.siret]) {
                console.log('Siege already exists in Salesforce.');
                parentAccountId = await getAccountIdBySiret({ siret: siege.siret });
            }else {
                console.warn('Siege does not exist; creating siege first.');
                const updatedDetails = await this.getCompanyDetails(this.companyDetails.siege.siret, true); // Fetch only for siege
                if (updatedDetails) {
                    this.companyDetails = { ...this.companyDetails, ...updatedDetails };
                    console.log('Company details updated with supplementary fields:', this.companyDetails);
                }
                // Create the siege account with additional fields
                parentAccountId = await createAccountWithFinancials({
                    name: nom_entreprise,
                    siret: siege.siret,
                    siren: siren_formate,
                    address: this.siegeAddress,
                    siege: true,
                    activity: libelle_code_naf,
                    employeeCount: effectif_max,
                    creationDate: new Date(date_creation),
                    tranche:effectif,
                    RecordIdLead: this.recordId,
                    financialData: await this.getFinancialData(siren_formate),
                    additionalFields: {
                        formeJuridique: forme_juridique,
                        numeroTVA: numero_tva_intracommunautaire,
                        immatriculationRCS: date_immatriculation_rcs,
                        immatriculationRNE: date_immatriculation_rne,
                        numeroRCS: numero_rcs,
                        capital: capital,
                        objetSocial: objet_social,
                        codeNAF: code_naf,
                        libelleCodeNAF: libelle_code_naf,
                        formeExercice: forme_exercice,
                        conventionsCollectives: conventions_collectives,
                        prochaineCloture: prochaine_date_cloture_exercice,
                        scoring_financier: this.companyDetails.scoring_financier
                    },
                });

                console.log('Siege account created with ID:', parentAccountId);
            }

            // Create the secondary establishment and link it to the siege
            const secondaryAccountId = await createAccountWithFinancials({
                name: secondaryEstablishmentData.name,
                siret: secondaryEstablishmentData.siret,
                siren: siren_formate,
                address: secondaryEstablishmentData.address,
                siege: false,
                activity: secondaryEstablishmentData.libelle_code_naf,
                employeeCount: secondaryEstablishmentData.effectif,
                creationDate: secondaryEstablishmentData.creationDate,
                tranche:secondaryEstablishmentData.tranche,
                RecordIdLead: this.recordId,
                financialData: [], // No financial data for secondary establishments
                additionalFields: {
                    parentId: parentAccountId, // Link to parent account
                    formeJuridique: forme_juridique,
                        numeroTVA: numero_tva_intracommunautaire,
                        immatriculationRCS: date_immatriculation_rcs,
                        immatriculationRNE: date_immatriculation_rne,
                        numeroRCS: numero_rcs,
                        capital: capital,
                        objetSocial: objet_social,
                        codeNAF: code_naf,
                        libelleCodeNAF: libelle_code_naf,
                        formeExercice: forme_exercice,
                        conventionsCollectives: conventions_collectives,
                        prochaineCloture: prochaine_date_cloture_exercice,
                    type: 'Établissement secondaire',
                },
            });
            

            console.log('Secondary establishment account created with ID:', secondaryAccountId);

            this.showToast('Succès', 'Établissement secondaire créé avec succès', 'success');

            // Navigate to the newly created secondary account record page
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: secondaryAccountId,
                    actionName: 'view',
                    objectApiName: 'Account',
                },
            });

        } else {
            // Case 2: User selected the siege (main establishment)
            console.log('Creating account for the siege.');

            const financialData = await this.getFinancialData(siren_formate);
            console.log('Financial data:', financialData);

           
            const updatedDetails = await this.getCompanyDetails(this.companyDetails.siege.siret, true); // Fetch with scoring_financier
            if (updatedDetails) {
                this.companyDetails = { ...this.companyDetails, ...updatedDetails }; // Merge new fields
                console.log('Updated company details with scoring_financier:', this.companyDetails);
            }
            const siegeAccountData = {
                name: nom_entreprise,
                siret: siege.siret,
                siren: siren_formate,
                address: this.siegeAddress,
                activity: libelle_code_naf,
                employeeCount: effectif_max,
                siege: true,
                creationDate: new Date(date_creation),
                tranche:effectif,
                RecordIdLead: this.recordId,
                additionalFields: {
                    formeJuridique: forme_juridique,
                    numeroTVA: numero_tva_intracommunautaire,
                    immatriculationRCS: date_immatriculation_rcs,
                    immatriculationRNE: date_immatriculation_rne,
                    numeroRCS: numero_rcs,
                    capital: capital,
                    objetSocial: objet_social,
                    codeNAF: code_naf,
                    libelleCodeNAF: libelle_code_naf,
                    formeExercice: forme_exercice,
                    conventionsCollectives: conventions_collectives,
                    prochaineCloture: prochaine_date_cloture_exercice,
                    scoring_financier: this.companyDetails.scoring_financier,
                },
            };

            console.log('Data for siege account creation:', siegeAccountData);

            const siegeAccountId = await createAccountWithFinancials({
                ...siegeAccountData,
                financialData: financialData,
            });

            console.log('Siege account created with ID:', siegeAccountId);

            // Handle cartography data for the siege
            const cartographyData = await this.getCartographyData(siren_formate);
            console.log('Cartography data:', cartographyData);

            await handleCartographyData({
                cartographyData: JSON.stringify(cartographyData),
                newAccountId: siegeAccountId,
            });

            this.showToast('Succès', 'Siège créé avec succès', 'success');

            // Navigate to the newly created siege account record page
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: siegeAccountId,
                    actionName: 'view',
                    objectApiName: 'Account',
                },
            });
        }

        // Close the modal if this component is inside a modal
        const closeEvent = new CustomEvent('close');
        this.dispatchEvent(closeEvent);

    } catch (error) {
        console.error('Error in account creation process:', error);
        this.showToast('Erreur', 'Erreur lors de la création du compte', 'error');
    }
}
async handleUpdateAccount() {
    console.log('handleUpdateAccount() method triggered for updating financial data.');

    if (!this.selectedEstablishment) {
        console.warn('No establishment selected.');
        return;
    }

    try {
        const isSecondaryEstablishment = !this.selectedEstablishment.siege; // Check if it's a secondary establishment
        let accountIdToUpdate = this.selectedEstablishment.accountId;

        if (isSecondaryEstablishment) {
            console.log('Selected establishment is a secondary establishment. Fetching parent account...');
            
            // Fetch the parent account ID for the secondary establishment
            const parentAccountId = await getParentAccountBySiret({ siret: this.selectedEstablishment.siret });
            if (!parentAccountId) {
                console.error('No parent account found for the secondary establishment.');
                this.showToast('Erreur', 'Aucun compte parent trouvé pour cet établissement secondaire.', 'error');
                return;
            }

            accountIdToUpdate = parentAccountId; // Set parent account ID to update
            console.log(`Parent account found: ${accountIdToUpdate}`);
        }

        console.log(`Updating financial data for account ID: ${accountIdToUpdate}`);

        // Fetch updated financial data using the SIREN
        const financialData = await this.getFinancialData(this.companyDetails.siren_formate);
        console.log('Fetched financial data:', financialData);

       

        // Call Apex to update the financial data for the selected/parent account
        const updateResult = await updateFinancialStatements({
            accountId: accountIdToUpdate,
            financialData: financialData
        });

        if (updateResult) {
            console.log('Financial data updated successfully:', updateResult);
            this.showToast('Succès', 'Les données financières ont été mises à jour avec succès.', 'success');
             // Navigate to the newly created siege account record page
             this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: parentAccountId,
                    actionName: 'view',
                    objectApiName: 'Account',
                },
            });

        // Close the modal if this component is inside a modal
        const closeEvent = new CustomEvent('close');
        this.dispatchEvent(closeEvent);
        } else {
            throw new Error('Failed to update financial data.');
        }
    } catch (error) {
        console.error('Error updating financial data:', error);
        this.showToast('Erreur', 'Une erreur s’est produite lors de la mise à jour des données financières.', 'error');
    }
}



    

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant,
            })
        );
    }

    get siegeAddress() {
        if (this.companyDetails && this.companyDetails.siege) {
            const siege = this.companyDetails.siege;
            let address = '';
            if (siege.numero_voie) {
                address += siege.numero_voie + ' ';
            }
            if (siege.indice_repetition) {
                address += siege.indice_repetition + ' ';
            }
            if (siege.type_voie) {
                address += siege.type_voie + ' ';
            }
            if (siege.libelle_voie) {
                address += siege.libelle_voie + ', ';
            }
            if (siege.code_postal) {
                address += siege.code_postal + ', ';
            }
            if (siege.ville) {
                address += siege.ville + ', ';
            }
            if (siege.pays) {
                address += siege.pays;
            }
            return address;
        }
        return 'Adresse non disponible';
    }
}