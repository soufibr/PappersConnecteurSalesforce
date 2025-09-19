public with sharing class AccountChecker {
    /*Vérifie si des comptes avec des SIRET donnés existent déjà dans Salesforce.*/
    @AuraEnabled(cacheable=true)
    public static Map<String, Boolean> checkAccountsBySiret(List<String> sirets) {
        System.debug('Liste des SIRET reçue : ' + sirets);
        Map<String, Boolean> accountStatusMap = new Map<String, Boolean>();
        
        // Requête pour trouver les comptes dont le SIRET est dans la liste
        List<Account> existingAccounts = [SELECT Id, SIRET__c FROM Account WHERE SIRET__c IN :sirets];
        System.debug('Comptes trouvés : ' + existingAccounts.size());

        // Ajouter les SIRET trouvés dans la Map avec "true"
        for (Account acc : existingAccounts) {
            accountStatusMap.put(acc.SIRET__c, true);
        }

        // Pour tous les SIRET non trouvés, on met "false" dans la Map
        for (String siret : sirets) {
            if (!accountStatusMap.containsKey(siret)) {
                accountStatusMap.put(siret, false);
            }
        }

        System.debug('Map finale : ' + accountStatusMap);
        return accountStatusMap;
    }
    
     @AuraEnabled(cacheable=true)
    public static Id getParentAccountBySiret(String siret) {
        try {
            // Find the account by SIRET
            Account secondaryAccount = [
                SELECT Id, ParentId 
                FROM Account 
                WHERE SIRET__c = :siret 
                LIMIT 1
            ];

            if (secondaryAccount != null && secondaryAccount.ParentId != null) {
                return secondaryAccount.ParentId; // Return the parent account ID
            } else {
                return null; // No parent account found
            }
        } catch (Exception ex) {
            System.debug('Error fetching parent account by SIRET: ' + ex.getMessage());
            throw new AuraHandledException('Erreur lors de la récupération du compte parent : ' + ex.getMessage());
        }
    }
    @AuraEnabled(cacheable=true)
    public static String getAccountIdBySiret(String siret) {
        System.debug('SIRET reçu pour la recherche de l\'AccountId : ' + siret);
        List<Account> accounts = [SELECT Id FROM Account WHERE SIRET__c = :siret LIMIT 1];
        if (!accounts.isEmpty()) {
            System.debug('Account trouvé avec l\'Id : ' + accounts[0].Id);
            return accounts[0].Id;
        }
        System.debug('Aucun compte trouvé pour le SIRET : ' + siret);
        return null;
    }

    
    /*Crée un compte dans Salesforce avec des informations financières, y compris les états financiers et d'autres détails (forme juridique, capital, conventions collectives,scoring financier, etc.).*/
    @AuraEnabled
    public static Id createAccountWithFinancials(String name, String siret,String siren, String address,Boolean siege, String activity, Integer employeeCount, Date creationDate,String tranche,Id RecordIdLead, List<Map<String, Object>> financialData, Map<String, Object> additionalFields) {
         System.debug('*** createAccountWithFinancials called with data: ' + name + ', ' + siret + ', ' + siren + ', ' + address + ', ' + activity + ', ' + employeeCount + ', ' + creationDate + ', ' + financialData);
    // Rest of your method implementation
       // Initialize fields for address components
    String billingStreet = null;
    String billingPostalCode = null;
    String billingCity = null;
	String billingCountry=null;
  if (String.isNotBlank(address)) {
        // Split the address by commas
        List<String> addressParts = address.split(',');
        
        // Trim each part and remove empty strings
        for (Integer i = 0; i < addressParts.size(); i++) {
            addressParts[i] = addressParts[i].trim();
        }

        // Assign parts to corresponding fields based on position
        if (addressParts.size() > 0) {
            billingStreet = addressParts[0]; // Street
        }
        if (addressParts.size() > 1) {
            billingPostalCode = addressParts[1]; // Postal code
        }
        if (addressParts.size() > 2) {
            billingCity = addressParts[2]; // City
        }
      	if (addressParts.size() > 3)
            { 
                billingCountry=addressParts[3];
            }
    }

    System.debug('BillingStreet: ' + billingStreet);
    System.debug('BillingPostalCode: ' + billingPostalCode);
    System.debug('BillingCity: ' + billingCity);
		
        Account newAccount = new Account();
        newAccount.Name = name;
        newAccount.SIRET__c = siret; 
        newAccount.SIREN__c = siren; 
        newAccount.BillingStreet = address;
        newAccount.Etablissement_siege__c=siege;
        newAccount.BillingStreet = billingStreet;
        newAccount.BillingPostalCode = billingPostalCode;
        newAccount.BillingCity = billingCity;
        newAccount.BillingCountry=billingCountry;
        newAccount.NumberOfEmployees=employeeCount;
        newAccount.Date_de_creation_de_letablissement__c=creationDate;
        newAccount.tranche_effectif__c=tranche;
         // Additional Fields Mapping
    if (additionalFields != null) {
        Id parentId = (Id) additionalFields.get('parentId');
            newAccount.ParentId = parentId; // Link to the parent account
            System.debug('Parent Account ID set: ' + parentId);
        newAccount.Forme_Juridique__c = (String) additionalFields.get('formeJuridique');
        newAccount.Numero_de_TVA__c = (String) additionalFields.get('numeroTVA');
        newAccount.Inscription_au_RCS__c = (String) additionalFields.get('immatriculationRCS');
        newAccount.Inscription_au_RNE__c = (String) additionalFields.get('immatriculationRNE');
        newAccount.Numero_RCS__c = (String) additionalFields.get('numeroRCS');
        newAccount.Capital_Social__c = (Decimal) additionalFields.get('capital');
        newAccount.Objet_Social__c = (String) additionalFields.get('objetSocial');
        newAccount.Code_NAF_ou_APE__c = (String) additionalFields.get('codeNAF') + ' - ' + (String) additionalFields.get('libelleCodeNAF');
        newAccount.Domaine_dactivite__c = (String) additionalFields.get('libelleCodeNAF');
        newAccount.Forme_dexercice__c = (String) additionalFields.get('formeExercice');
         List<Object> conventions = (List<Object>) additionalFields.get('conventionsCollectives');
            if (conventions != null && !conventions.isEmpty()) {
                List<String> conventionNames = new List<String>();
                for (Object conventionObj : conventions) {
                   if (conventionObj instanceof Map<Object, Object>) {
            Map<Object, Object> rawMap = (Map<Object, Object>) conventionObj;

            // Convert Map<Object, Object> to Map<String, Object>
            Map<String, Object> tempMap = new Map<String, Object>();
            for (Object key : rawMap.keySet()) {
                tempMap.put((String) key, rawMap.get(key));
            }

            // Process the safely casted map
            if (tempMap.containsKey('nom')) {
                conventionNames.add((String) tempMap.get('nom'));
            }
        } else {
            System.debug('Unexpected data structure in conventions_collectives: ' + conventionObj);
        }
    }
    // Join all convention names with a separator (e.g., comma)
    newAccount.Convention_collective__c = String.join(conventionNames, ', ');
            }
                
        newAccount.Date_de_cloture_dexercice_comptable__c = (String)additionalFields.get('prochaineCloture');

 // Process scoring_financier
if (additionalFields.containsKey('scoring_financier')) {
    try {
        // Extract scoring_financier as a map
        Map<String, Object> scoring = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(additionalFields.get('scoring_financier')));
        System.debug('Processing scoring_financier field: ' + scoring);

        // Extract top-level fields
        newAccount.Scoring_Financier_Note__c = (String) scoring.get('note');
        newAccount.Scoring_Financier_Score__c = (Decimal) scoring.get('score');

        newAccount.Scoring_Date_de_Calcul__c = (String) scoring.get('date_calcul');

        // Extract details_score if present
        if (scoring.containsKey('details_score') && scoring.get('details_score') != null) {
            Map<String, Object> detailsScore = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(scoring.get('details_score')));
            System.debug('Processing details_score field: ' + detailsScore);

            // Map individual details_score fields
            newAccount.Scoring_Financier_Score_Ebit_CA__c = (Decimal) detailsScore.get('score_ebit_ca');
            newAccount.Scoring_Financier_Fonds_de_roulement__c = (Decimal) detailsScore.get('score_fonds_de_roulement');
            newAccount.Scoring_Financier_Tresorerie_nette__c = (Decimal) detailsScore.get('score_tresorerie_nette');
            newAccount.Scoring_Financier_Dettes_Fiscales_CA__c = (Decimal) detailsScore.get('score_dettes_fiscales_ca');
           // newAccount.Scoring_Financier_Dettes_Fiscales_VA__c = (Decimal) detailsScore.get('score_dettes_fiscales_va');
            //newAccount.Scoring_Financier_Cash_Flow__c = (Decimal) detailsScore.get('score_cash_flow');
            newAccount.Scoring_Financier_C_F_Nettes__c = (Decimal) detailsScore.get('score_charges_financieres_nettes');
        } else {
            System.debug('details_score field missing or invalid in scoring_financier');
        }
    } catch (Exception e) {
        System.debug('Invalid scoring_financier structure: ' + additionalFields.get('scoring_financier'));
        System.debug('Error: ' + e.getMessage());
    }
} else {
    System.debug('scoring_financier field not found in additionalFields');
}


    }
        //newAccount.Industry = activity;
        //newAccount.NumberOfEmployees = employeeCount;
        //newAccount.Founded_Date__c = creationDate; // Assuming you have a custom field for creation date

        try {
            insert newAccount;
			if(RecordIdLead!=null)
            {
                // Query Lead record
List<Lead> leadList = [SELECT Account__c FROM Lead WHERE Id = :RecordIdLead];

if (!leadList.isEmpty()) {  // Check if the list contains any records
    Lead leadRecord = leadList[0];  // Get the first record
    leadRecord.Account__c = newAccount.Id;  // Assign the new Account ID
    update leadRecord;  // Update the Lead record
} else {
    System.debug('No Lead record found for the given ID.');
}
            }
            // Insert related Financial Statement records
            List<Financial_Statement__c> financialStatements = new List<Financial_Statement__c>();
            for (Map<String, Object> yearData : financialData) {
                Financial_Statement__c statement = new Financial_Statement__c();
                statement.Account__c = newAccount.Id;
 Object yearValue = yearData.get('annee');
    if (yearValue != null) {
        if (yearValue instanceof Decimal || yearValue instanceof Integer) {
            statement.Name = String.valueOf(yearValue);
            statement.Annee__c = String.valueOf(yearValue);
        } else if (yearValue instanceof String) {
            statement.Name = (String) yearValue;
            statement.Annee__c = (String) yearValue;
        } else {
            throw new AuraHandledException('Invalid type for "annee": ' + yearValue);
        }
    } 
                statement.chiffre_affaires__c = (Decimal) yearData.get('chiffre_affaires');
                statement.Marge_brute__c = (Decimal) yearData.get('marge_brute');
                statement.EBITDA_EBE__c = (Decimal) yearData.get('ebitda');
                statement.Resultat_dexploitation__c = (Decimal) yearData.get('resultat_exploitation');
                statement.Resultat_net__c = (Decimal) yearData.get('resultat_net');
                statement.Taux_de_croissance_du_CA__c = (Decimal) yearData.get('taux_croissance_ca');
                statement.Taux_de_marge_brute__c = (Decimal) yearData.get('taux_marge_brute');
                statement.Taux_de_marge_dEBITDA__c = (Decimal) yearData.get('taux_marge_ebitda');
                statement.Taux_de_marge_oprationnelle__c = (Decimal) yearData.get('taux_marge_operationnelle');
                statement.BFR__c = (Decimal) yearData.get('bfr');
                statement.BFR_exploitation__c = (Decimal) yearData.get('bfr_exploitation');
                statement.BFR_hors_exploitation__c = (Decimal) yearData.get('bfr_hors_exploitation');
                statement.BFR_j_de_CA__c = (Decimal) yearData.get('BFR_jours_CA');
                statement.Capacite_dautofinancement__c = (Decimal) yearData.get('capacite_autofinancement');
                statement.Fonds_de_roulement_net_global__c = (Decimal) yearData.get('fonds_roulement_net_global');
                statement.Trsorerie__c = (Decimal) yearData.get('tresorerie');
                statement.Dettes_financires__c = (Decimal) yearData.get('dettes_financieres');
                statement.Capacit_de_remboursement__c = (Decimal) yearData.get('capacite_remboursement');
                statement.Ratio_dendettement_Gearing__c = (Decimal) yearData.get('ratio_endettement');
                statement.Autonomie_financiere__c = (Decimal) yearData.get('autonomie_financiere');
                statement.tat_des_dettes_1_an_au_plus__c = (Decimal) yearData.get('etat_dettes_1_an_au_plus');
                statement.Liquidit_generale__c = (Decimal) yearData.get('liquidite_generale');
                statement.Couverture_des_dettes__c = (Decimal) yearData.get('couverture_dettes');
                statement.Fonds_propres__c = (Decimal) yearData.get('fonds_propres');
                statement.Marge_nette__c = (Decimal) yearData.get('marge_nette');
                statement.Rentabilit_sur_fonds_propres__c = (Decimal) yearData.get('rentabilite_fonds_propres');
                statement.Rentabilite_economique__c = (Decimal) yearData.get('rentabilite_economique');
                statement.Valeur_ajoutee__c = (Decimal) yearData.get('valeur_ajoutee');
                statement.Salaires_et_charges_sociales__c = (Decimal) yearData.get('salaires_charges_sociales');
                statement.Salaires_CA__c = (Decimal) yearData.get('salaires_CA');
                statement.Impots_et_taxes__c = (Decimal) yearData.get('impots_taxes');

                financialStatements.add(statement);
            }

            insert financialStatements;
			
            return newAccount.Id;
        } catch (DmlException e) {
            throw new AuraHandledException('Error creating Account or Financial Statements: ' + e.getMessage());
        }
    }
@AuraEnabled
public static void handleCartographyData(String cartographyData, Id newAccountId) {
    // Désérialisation des données JSON
    Map<String, Object> parsedData = (Map<String, Object>) JSON.deserializeUntyped(cartographyData);

    List<Cartographie__c> cartographieRecords = new List<Cartographie__c>();
    List<Cartographie__c> personnesRecords = new List<Cartographie__c>();
    Map<String, Id> entrepriseIdToCartographieId = new Map<String, Id>();
    Map<String, Id> personneIdToCartographieId = new Map<String, Id>();

    // Étape 1 : Insérer les entreprises dans Cartographie__c
    if (parsedData.containsKey('entreprises') && parsedData.get('entreprises') instanceof List<Object>) {
        List<Object> entreprises = (List<Object>) parsedData.get('entreprises');

        for (Object entrepriseObj : entreprises) {
            if (entrepriseObj instanceof Map<String, Object>) {
                Map<String, Object> entreprise = (Map<String, Object>) entrepriseObj;

                if (entreprise.containsKey('nom_entreprise') && entreprise.containsKey('siren') && entreprise.containsKey('id')) {
                    Cartographie__c cartographie = new Cartographie__c();
                    cartographie.Name = (String) entreprise.get('nom_entreprise');
                    cartographie.SIREN__c = (String) entreprise.get('siren');
                    cartographie.Account__c = newAccountId;
                    cartographie.Entreprise_Code__c = (String) entreprise.get('id');
                    cartographieRecords.add(cartographie);
                    entrepriseIdToCartographieId.put((String) entreprise.get('id'), null);
                }
            }
        }

        try {
            insert cartographieRecords;
            for (Cartographie__c cart : cartographieRecords) {
                entrepriseIdToCartographieId.put(cart.Entreprise_Code__c, cart.Id);
            }
        } catch (DmlException e) {
            throw new AuraHandledException('Erreur lors de l\'insertion des entreprises : ' + e.getMessage());
        }
    }

    // Étape 2 : Insérer les personnes dans Cartographie__c
    if (parsedData.containsKey('personnes') && parsedData.get('personnes') instanceof List<Object>) {
        List<Object> personnes = (List<Object>) parsedData.get('personnes');

        for (Object personneObj : personnes) {
            if (personneObj instanceof Map<String, Object>) {
                Map<String, Object> personne = (Map<String, Object>) personneObj;

                if (personne.containsKey('prenom') && personne.containsKey('nom') && personne.containsKey('id')) {
                    Cartographie__c personneRecord = new Cartographie__c();
                    personneRecord.Name = (String) personne.get('prenom') + ' ' + (String) personne.get('nom');
                    personneRecord.Entreprise_Code__c = (String) personne.get('id'); // Nouveau champ pour stocker l'identifiant unique
                    personneRecord.Account__c = newAccountId;
                    
                    personnesRecords.add(personneRecord);
                    personneIdToCartographieId.put((String) personne.get('id'), null);
                }
            }
        }

        try {
            insert personnesRecords;
            for (Cartographie__c personne : personnesRecords) {
                personneIdToCartographieId.put(personne.Entreprise_Code__c, personne.Id);
            }
        } catch (DmlException e) {
            throw new AuraHandledException('Erreur lors de l\'insertion des personnes : ' + e.getMessage());
        }
    }

    // Étape 3 : Insérer les relations entre entreprises (Lien_Entreprise__c)
    List<Lien_Entreprise__c> lienEntrepriseRecords = new List<Lien_Entreprise__c>();

    if (parsedData.containsKey('liens_entreprises_entreprises') && parsedData.get('liens_entreprises_entreprises') instanceof List<Object>) {
        List<Object> relationsEntreprises = (List<Object>) parsedData.get('liens_entreprises_entreprises');

        for (Object relationObj : relationsEntreprises) {
            if (relationObj instanceof List<Object>) {
                List<Object> relation = (List<Object>) relationObj;

                if (relation.size() == 2 && relation[0] instanceof String && relation[1] instanceof String) {
                    String primaryId = (String) relation[0];
                    String relatedId = (String) relation[1];

                    Id primaryCartographieId = entrepriseIdToCartographieId.get(primaryId);
                    Id relatedCartographieId = entrepriseIdToCartographieId.get(relatedId);

                    if (primaryCartographieId != null && relatedCartographieId != null) {
                        Lien_Entreprise__c lien = new Lien_Entreprise__c();
                        lien.Primary_Entreprise__c = primaryCartographieId;
                        lien.Related_Entreprise__c = relatedCartographieId;
                        lien.Name = primaryId + '-' + relatedId;
                        lienEntrepriseRecords.add(lien);
                    }
                }
            }
        }

        try {
            insert lienEntrepriseRecords;
        } catch (DmlException e) {
            throw new AuraHandledException('Erreur lors de l\'insertion des relations entreprises : ' + e.getMessage());
        }
    }

    // Étape 4 : Insérer les relations entre entreprises et personnes (Lien_Entreprise__c)
    List<Lien_Entreprise__c> lienPersonneRecords = new List<Lien_Entreprise__c>();

    if (parsedData.containsKey('liens_entreprises_personnes') && parsedData.get('liens_entreprises_personnes') instanceof List<Object>) {
        List<Object> relationsPersonnes = (List<Object>) parsedData.get('liens_entreprises_personnes');

        for (Object relationObj : relationsPersonnes) {
            if (relationObj instanceof List<Object>) {
                List<Object> relation = (List<Object>) relationObj;

                if (relation.size() == 2 && relation[0] instanceof String && relation[1] instanceof String) {
                    String entrepriseId = (String) relation[0];
                    String personneId = (String) relation[1];

                    Id entrepriseCartographieId = entrepriseIdToCartographieId.get(entrepriseId);
                    Id personneCartographieId = personneIdToCartographieId.get(personneId);

                    if (entrepriseCartographieId != null && personneCartographieId != null) {
                        Lien_Entreprise__c lien = new Lien_Entreprise__c();
                        lien.Primary_Entreprise__c = entrepriseCartographieId; // L'entreprise
                        lien.Related_Entreprise__c = personneCartographieId; // La personne
                        lien.Name = entrepriseId + '-' + personneId;
                        lienPersonneRecords.add(lien);
                    }
                }
            }
        }

        try {
            insert lienPersonneRecords;
        } catch (DmlException e) {
            throw new AuraHandledException('Erreur lors de l\'insertion des relations entreprises-personnes : ' + e.getMessage());
        }
    }
}


}