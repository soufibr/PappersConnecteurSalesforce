@isTest
public class CartographyControllerTest {

    @testSetup
    static void setupTestData() {
        // Création d'un compte de test
        Account testAccount = new Account(Name = 'Test Account', SIREN__c = '123456789');
        insert testAccount;

        // Création des enregistrements Cartographie
        Cartographie__c centralNode = new Cartographie__c(
            Name = 'Central Node',
            Entreprise_Code__c = 'e1',
            Account__c = testAccount.Id
        );

        Cartographie__c node1 = new Cartographie__c(
            Name = 'Node 1',
            Entreprise_Code__c = 'e2',
            Account__c = testAccount.Id
        );

        Cartographie__c node2 = new Cartographie__c(
            Name = 'Node 2',
            Entreprise_Code__c = 'e3',
            Account__c = testAccount.Id
        );

        insert new List<Cartographie__c>{centralNode, node1, node2};

        // Création des enregistrements Lien_Entreprise
        Lien_Entreprise__c link = new Lien_Entreprise__c(
            Primary_Entreprise__c = centralNode.Id,
            Related_Entreprise__c = node1.Id
        );

        insert link;
    }

    @isTest
    static void testGetCartography() {
        // Récupération du compte de test
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];

        // Appel de la méthode
        Map<String, Object> result = CartographyController.getCartography(testAccount.Id);

        // Vérifications
        System.assert(result != null, 'Le résultat ne doit pas être null');
        System.assert(result.containsKey('centralNode'), 'Le résultat doit contenir le centralNode');
        System.assert(result.containsKey('entreprises'), 'Le résultat doit contenir les entreprises');
        System.assert(result.containsKey('liens_entreprises_entreprises'), 'Le résultat doit contenir les liens');

        // Vérification des détails du centralNode
        Map<String, String> centralNode = (Map<String, String>) result.get('centralNode');
        System.assertEquals('Central Node', centralNode.get('name'), 'Le centralNode doit correspondre');

        // Vérification des entreprises
        List<Map<String, String>> entreprises = (List<Map<String, String>>) result.get('entreprises');
        System.assertEquals(2, entreprises.size(), 'Il doit y avoir 2 entreprises autres que le centralNode');

        // Vérification des liens
        List<List<String>> liens = (List<List<String>>) result.get('liens_entreprises_entreprises');
        System.assertEquals(1, liens.size(), 'Il doit y avoir 1 lien');
    }

    @isTest
    static void testGetCartographyCentralNodeNotFound() {
        // Création d'un compte sans centralNode
        Account noCentralAccount = new Account(Name = 'No Central Node Account', SIREN__c = '987654321');
        insert noCentralAccount;

        Cartographie__c node = new Cartographie__c(
            Name = 'Node Without Central',
            Entreprise_Code__c = 'e2',
            Account__c = noCentralAccount.Id
        );
        insert node;

        // Appel de la méthode et vérification de l'exception
        try {
            CartographyController.getCartography(noCentralAccount.Id);
            System.assert(false, 'Une exception aurait dû être levée pour l\'absence de centralNode');
        } catch (AuraHandledException e) {
            //System.assertEquals('Central node (e1) not found.', e.getMessage(), 'Le message d\'erreur doit correspondre');
        }
    }

    @isTest
    static void testGetExistingAccountFound() {
        // Appel de la méthode avec un compte existant
        Map<String, String> result = CartographyController.getExistingAccount('Test Account', '123456789');

        // Vérifications
        System.assert(result != null, 'Le résultat ne doit pas être null');
        System.assertEquals('true', result.get('exists'), 'Le compte doit exister');
        //System.assertNotNull(result.get('accountId'), 'L\'ID du compte doit être présent');
        System.assertEquals('Test Account', result.get('accountName'), 'Le nom du compte doit correspondre');
    }

    @isTest
    static void testGetExistingAccountNotFound() {
        // Appel de la méthode avec un compte inexistant
        Map<String, String> result = CartographyController.getExistingAccount('Nonexistent Account', '000000000');

        // Vérifications
        System.assert(result != null, 'Le résultat ne doit pas être null');
        System.assertEquals('false', result.get('exists'), 'Le compte ne doit pas exister');
        //System.assertNull(result.get('accountId'), 'L\'ID du compte ne doit pas être présent');
    }
}