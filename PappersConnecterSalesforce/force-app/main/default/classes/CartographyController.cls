public with sharing class CartographyController {
     @AuraEnabled
    public static Map<String, Object> getCartography(Id accountId) {
        Map<String, Object> response = new Map<String, Object>();

        // Étape 1 : Récupérer toutes les entreprises liées au compte
        List<Cartographie__c> entreprises = [
            SELECT Id, Name, Entreprise_Code__c
            FROM Cartographie__c
            WHERE Account__c = :accountId
        ];

        // Identifier le nœud central comme l'entreprise avec Entreprise_Code__c = 'e1'
        Cartographie__c centralNodeRecord = null;
        for (Cartographie__c entreprise : entreprises) {
            if (entreprise.Entreprise_Code__c == 'e1') {
                centralNodeRecord = entreprise;
                break;
            }
        }

        if (centralNodeRecord == null) {
            throw new AuraHandledException('Central node (e1) not found.');
        }

        // Ajouter les détails du nœud central à la réponse
        Map<String, String> centralNode = new Map<String, String>{
            'id' => centralNodeRecord.Id,
            'name' => centralNodeRecord.Name
        };
        response.put('centralNode', centralNode);

        // Filtrer les autres entreprises
        List<Map<String, String>> nodes = new List<Map<String, String>>();
        for (Cartographie__c entreprise : entreprises) {
            if (entreprise.Id != centralNodeRecord.Id) {
                nodes.add(new Map<String, String>{
                    'id' => entreprise.Id,
                    'name' => entreprise.Name
                });
            }
        }
        response.put('entreprises', nodes);

        // Étape 2 : Récupérer toutes les personnes liées au compte
        List<Cartographie__c> personnes = [
            SELECT Id, Name, Entreprise_Code__c
            FROM Cartographie__c
            WHERE Account__c = :accountId
              AND Entreprise_Code__c != null
        ];

        List<Map<String, String>> personneNodes = new List<Map<String, String>>();
        for (Cartographie__c personne : personnes) {
            personneNodes.add(new Map<String, String>{
                'id' => personne.Id,
                'name' => personne.Name
            });
        }
        response.put('personnes', personneNodes);

        // Étape 3 : Récupérer les liens entreprises-entreprises
        List<Lien_Entreprise__c> entrepriseLinks = [
            SELECT Primary_Entreprise__c, Related_Entreprise__c
            FROM Lien_Entreprise__c
            WHERE Primary_Entreprise__r.Account__c = :accountId
        ];

        List<List<String>> entrepriseEdges = new List<List<String>>();
        for (Lien_Entreprise__c link : entrepriseLinks) {
            entrepriseEdges.add(new List<String>{
                String.valueOf(link.Primary_Entreprise__c),
                String.valueOf(link.Related_Entreprise__c)
            });
        }
        response.put('liens_entreprises_entreprises', entrepriseEdges);

        // Étape 4 : Récupérer les liens entreprises-personnes
        List<Lien_Entreprise__c> personneLinks = [
            SELECT Primary_Entreprise__c, Related_Entreprise__c
            FROM Lien_Entreprise__c
            WHERE Primary_Entreprise__r.Account__c = :accountId
              AND Related_Entreprise__r.Entreprise_Code__c != null
        ];

        List<List<String>> personneEdges = new List<List<String>>();
        for (Lien_Entreprise__c link : personneLinks) {
            personneEdges.add(new List<String>{
                String.valueOf(link.Primary_Entreprise__c),
                String.valueOf(link.Related_Entreprise__c)
            });
        }
        response.put('liens_entreprises_personnes', personneEdges);

        return response;
    }
       @AuraEnabled
    public static Map<String, String> getExistingAccount(String name, String siren) {
        Map<String, String> result = new Map<String, String>();
        result.put('exists', 'false'); // Default to not found

        // Remove spaces from the provided SIREN
        String normalizedSiren = siren.replaceAll('\\s+', '');
	String namePattern = '%' + name + '%';
        // Query Account where Name and normalized SIREN match
        List<Account> accounts = [
            SELECT Id, Name, SIREN__c 
            FROM Account 
             WHERE Name LIKE :namePattern
              AND SIREN__c != null
        ];

        for (Account acc : accounts) {
            // Normalize SIREN from Account and compare
            if (acc.SIREN__c.replaceAll('\\s+', '') == normalizedSiren) {
                result.put('exists', 'true');
                result.put('accountId', acc.Id);
                result.put('accountName', acc.Name);
                break;
            }
        }

        return result;
    }
}