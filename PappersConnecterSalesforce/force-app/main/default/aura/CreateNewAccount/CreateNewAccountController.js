({
    doInit: function(component, event, helper) {
        component.set("v.isOpen", true); // Open the modal on component initialization
    },

    closeModal: function(component, event, helper) {
        component.set("v.isOpen", false); // Close the modal when close button is clicked
        // Navigate back to the list view if needed or perform other cleanups
        const navEvt = $A.get("e.force:navigateToList");
        navEvt.setParams({
            "scope": "Account"
        });
        navEvt.fire();
    }
})