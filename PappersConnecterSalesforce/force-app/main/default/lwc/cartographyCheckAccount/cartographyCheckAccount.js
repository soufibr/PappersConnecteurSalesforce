import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import getExistingAccount from '@salesforce/apex/CartographyController.getExistingAccount';
import { NavigationMixin } from 'lightning/navigation';
import handleCartographyData from '@salesforce/apex/AccountChecker.handleCartographyData';
import API_Key_Pappers from '@salesforce/label/c.API_Key_Pappers';
import createAccountWithFinancials from '@salesforce/apex/AccountChecker.createAccountWithFinancials';
import checkAccountsBySiret from '@salesforce/apex/AccountChecker.checkAccountsBySiret';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
// Fields to fetch from Cartographie__c
const FIELDS = ['Cartographie__c.Name', 'Cartographie__c.SIREN__c','Cartographie__c.Account__c'];

export default class CartographyCheckAccount extends NavigationMixin(LightningElement) {
    @api recordId; // Automatically passed by the page layout
    @track cartographyName = ''; // Holds Cartographie Name
    @track siren = ''; // Holds SIREN
    @track existingAccountId = null; // If an account exists, its ID is stored
    @track existingAccountName = null; // If an account exists, its Name is stored
    @track isLoading = true; // To show loading indicator while fetching data
    @track siret;
    @track companyDetails;
    @track parentAccountId;
    // Fetch Cartographie data from the current record
    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredCartography({ error, data }) {
        if (data) {
            this.cartographyName = data.fields.Name.value;
            this.siren = data.fields.SIREN__c.value;
            this.parentAccountId=data.fields.Account__c.value;
            console.log('Cartographie data fetched:', this.cartographyName, this.siren);
            
                this.handleCartographyMatch(this.cartographyName, this.siren);
            // Check for existing account once Cartographie data is fetched
            this.checkAccountExistence();
        } else if (error) {
            console.error('Error fetching Cartographie data:', error);
            this.isLoading = false;
        }
    }
    get without() {
        if(this.siret==null)
            return true;
    }   
    showToast(title, message, variant) {
        const toastEvent = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant || 'info', // Par défaut, 'info'
        });
        this.dispatchEvent(toastEvent); // Envoi de l'événement
    }
    // Check if an Account already exists
    async checkAccountExistence() {
        try {
            const result = await getExistingAccount({
                name: this.cartographyName,
                siren: this.siren
            });

            if (result.exists === 'true') {
                this.existingAccountId = result.accountId;
                this.existingAccountName = result.accountName;
            } else {
                this.existingAccountId = null;
                this.existingAccountName = null;
            }
        } catch (error) {
            console.error('Error fetching account existence:', error);
        } finally {
            this.isLoading = false; // Stop loading spinner
        }
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
    // Navigate to existing Account
    navigateToAccount() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.existingAccountId,
                actionName: 'view',
                objectApiName: 'Account'
            }
        });
    }
    suggestionsMap = new Map();
 // Method to fetch suggestions from the external API
 getSuggestions(query) {
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
    handleCartographyMatch(cartographyName, siren) {
        const query = cartographyName;
    
        this.getSuggestions(query)
            .then((data) => {
                console.log('Suggestions fetched for Cartography:', data);
    
                // Find a match by SIREN
                const matchedCompany = data.resultats_nom_entreprise.find(
                    (item) => item.siren === siren
                );
    
                if (matchedCompany) {
                    console.log('Match found:', matchedCompany);
    
                    // Fetch company details using the matched company's SIRET
                     this.siret = matchedCompany.siege.siret;
                    console.log('Company details siret:', this.siret);
                    if (this.siret) {
                        if(this.existingAccountId==null)
                        {
                            this.getCompanyDetails(this.siret,false)
                            .then((details) => {
                                console.log('Company details fetched:', details);
                                console.log('Company details siret:', details.siege.siret);
                                console.log('Company details siege:', details.siege.siege);
                                this.companyDetails=details;
                                // Here you can call the Apex method to create the account
                                //this.createAccount(details);
                            })
                            .catch((error) =>
                                console.error('Error fetching company details:', error)
                            );
                        }
                        
                    } else {
                        console.warn('No SIRET found for the matched company');
                    }
                } else {
                    console.warn(
                        'No matching company found for CartographyName and SIREN'
                    );
                }
            })
            .catch((error) =>
                console.error('Error fetching suggestions for Cartography match:', error)
            );
    }
    
    // Emit event to parent to trigger Account creation
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
}