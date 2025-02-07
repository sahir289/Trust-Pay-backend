export const parseJSON = (data) => {
    try {
        return JSON.parse(data);
    } catch (err) {
        console.error(err);
        return {};
    }
}

export const stringifyJSON = (data) => {
    try {
        return JSON.stringify(data);
    } catch (err) {
        console.error(err);
        return '{}';
    }
}