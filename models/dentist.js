
/**
 * Data class to hold information about a dentist.
 */
export class Dentist {
    name = null;
    info = {};

    toJSON() {
        return {
            name : this.name,
            info : this.info
        }
    }
}

