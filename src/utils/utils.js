export const calculateCommission = (amount, percentage) => {
    return (amount * percentage) / 100;
};


export const calculateDuration = (createdAt) => {
    const durMs = new Date() - createdAt;
    const durSeconds = Math.floor((durMs / 1000) % 60).toString().padStart(2, '0');
    const durMinutes = Math.floor((durSeconds / 60) % 60).toString().padStart(2, '0');
    const durHours = Math.floor((durMinutes / 60) % 24).toString().padStart(2, '0');
    const duration = `${durHours}:${durMinutes}:${durSeconds}`;
    return duration;
}