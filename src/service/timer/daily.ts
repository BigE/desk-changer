import ServiceTimerHourly from './hourly.js';

export default class ServiceTimerDaily extends ServiceTimerHourly {
    protected __callback__(): boolean {
        const date = new Date();

        if (date.getHours() === 0) return super.__callback__();
        return true;
    }
}
