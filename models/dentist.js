
/**
 * Data class to hold information about a dentist.
 */
export class Dentist {
    name = null;
    address = null;
    specialty = null;

    // Contact info
    phone = null;
    email = null;
    website = null;

    getJSON() {
        return {
            name : this.name,
            address : this.address,
            specialty : this.specialty,
            contact : {
                phone : this.phone,
                email : this.email,
                website : this.website
            }
        }
    }
}

