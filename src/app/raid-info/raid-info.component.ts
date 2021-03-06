import {Component, Input, OnInit} from '@angular/core';
import {Raid} from '../models/Raid';
import {Settings} from '../Settings';
import {Player} from '../models/Player';
import {PlayerClass} from '../models/PlayerClass';
import {Spec} from '../models/Spec';
import {Backend} from '../Backend';
import {AlertController, ModalController, ToastController} from '@ionic/angular';
import {OktaAuthService} from '@okta/okta-angular';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {DkpLogType} from '../models/DkpLogType';
import {DkpEntry} from '../models/DkpEntry';
import {Bosses} from "../helper/Bosses";
import {CreateAuctionComponent} from "../create-auction/create-auction.component";
import {Auction} from "../models/Auction";


@Component({
    selector: 'app-raid-info',
    templateUrl: './raid-info.component.html',
    styleUrls: ['./raid-info.component.scss'],
})


export class RaidInfoComponent implements OnInit {
    get boss(): string {
        return this._boss;
    }

    set boss(value: string) {
        this._boss = value;
    }

    private _boss: string;

    get bossList() {
        return Bosses.BossList(this.raid.dungeonName);
    }

    get lootList() {
        return Bosses.LootList(this.boss) || [];
    }


    get reason(): string {
        return this._reason;
    }

    get dkp(): number {
        return this._dkp;
    }

    private isModalPresent: boolean;


    private _reason: string;
    private _dkp: number;
    private _playersNotInRaid: Player[] = [];

    constructor(
        private modalController: ModalController,
        private oktaAuth: OktaAuthService,
        private http: HttpClient,
        private toastController: ToastController,
        private alertController: AlertController) {
    }

    ngOnInit() {

    }


    @Input() raid: Raid;


    get PlayerClass() {
        return PlayerClass;
    }

    get allClasses() {
        return Object.keys(PlayerClass);
    }

    get isUserAllowedToEdit() {
        return this.myChar.isAdmin || (this.raid.raidCreator && this.raid.raidCreator._id === this.myChar._id)
            || (this.raid.raidLead && this.raid.raidLead._id === this.myChar._id);
    }

    isAlreadyRegistered(): boolean {
        return this.raid.confirm.some(reg => reg.player.mail === this.myChar.mail)
            || this.raid.bench.some(reg => reg.player.mail === this.myChar.mail)
            || this.raid.late.some(reg => reg.player.mail === this.myChar.mail)
            || this.raid.decline.some(reg => reg.player.mail === this.myChar.mail);
    }

    isPlayerAlreadyRegistered(player: Player): boolean {
        return this.raid.confirm.some(reg => reg.player.mail === player.mail)
            || this.raid.bench.some(reg => reg.player.mail === player.mail)
            || this.raid.late.some(reg => reg.player.mail === player.mail)
            || this.raid.decline.some(reg => reg.player.mail === player.mail);
    }

    getAllRegisteredPlayers(): Player[] {
        const allRegs = this.raid.confirm.concat(this.raid.late).concat(this.raid.decline).concat(this.raid.bench);
        return allRegs.map(reg => reg.player);
    }

    get confirmedHeals() {
        return this.raid.confirm.filter((reg) => {
            return reg.player.spec === Spec.Heal;
        });
    }

    get confirmedDDs() {
        return this.raid.confirm.filter((reg) => {
            return reg.player.spec === Spec.DD;
        });
    }

    get confirmedTanks() {
        return this.raid.confirm.filter((reg) => {
            return reg.player.spec === Spec.Tank;
        });
    }

    findConfirmedPlayersOfOneClass(playerClass: PlayerClass): Player[] {
        const players = this.raid.confirm;
        return players.filter((registration) => {
            return registration.player.playerClass === playerClass;
        }).map(registration => registration.player);
    }

    findConfirmedPlayersOfOneClassByString(playerClass: String): Player[] {
        const players = this.raid.confirm;
        const player = players.filter((registration) => {
            return registration.player.playerClass == playerClass;
        }).map(registration => registration.player);
        return player;
    }

    get myChar() {
        return Settings.Instance.player;
    }


    async showCreateAuctionModal() {
        if (this.isModalPresent) {
            return;
        }
        this.isModalPresent = true;
        const modal = await this.modalController.create({
            component: CreateAuctionComponent,
            componentProps: {
                lootIds: this.lootList
            }
        });
        await modal.present();
        modal.onDidDismiss().then((callback) => {
            if (callback.data) {
                const auctions: Auction[] = callback.data.auctions;
                this.postAuctions(auctions);
            }
            this.isModalPresent = false;
        });
    }

    async presentToast(msg) {
        const toast = await this.toastController.create({
            message: msg,
            duration: 2000
        });
        toast.present();
    }

    private async postAuctions(auctions: Auction[]) {
        const token = await this.oktaAuth.getAccessToken();
        const options = await Backend.getHttpOptions(token);

        console.log(auctions)

        this.http.post(Backend.address + '/auctions', auctions, options)
            .subscribe(() => {
                console.log('auction creation successful!');
                this.presentToast('Yeah die Auktionen wurden erstellt!');
                this.giveBossKillDKP();
            }, (e) => {
                console.log(e);
                this.presentToast('Da ist wohl was schiefgegangen 🤮');
            });

    }


    async presentMovePlayerAlert(player: Player) {
        const alert = await this.alertController.create({
            header: 'Verschiebe in',
            inputs: [
                {
                    name: 'confirm',
                    type: 'radio',
                    label: '✅ Zusage',
                    value: 'confirm',
                },
                {
                    name: 'decline',
                    type: 'radio',
                    label: '❌ Absage',
                    value: 'decline'
                },
                {
                    name: 'bench',
                    type: 'radio',
                    label: '🪑 Ersatzbank',
                    value: 'bench'
                },
                {
                    name: 'late',
                    type: 'radio',
                    label: '⌛️ Verspätung',
                    value: 'late'
                }
            ],
            buttons: [
                {
                    text: 'Abbrechen',
                    role: 'cancel',
                    cssClass: '',
                    handler: () => {
                        console.log('Cancel');
                    }
                }, {
                    text: 'Abschicken',

                    handler: (registrationType) => {
                        if (registrationType) {
                            console.log('reg' + registrationType);
                            this.changePlayerRegistration(player, registrationType);
                        } else {
                            this.presentToast('Du musst schon etwas auswählen 😜');
                            return false;
                        }

                    }
                }
            ]
        });

        await alert.present();
    }


    async changePlayerRegistration(player: Player, registrationType: string) {
        const token = await this.oktaAuth.getAccessToken();
        const options = await Backend.getHttpOptions(token);

        const body = {raid: this.raid, player, registrationType};

        this.http.patch(Backend.address + '/raid/register', body, options)
            .subscribe((data) => {
                console.log('registration changed', data);
                this.http.patch(Backend.address + '/raid/register', body, options);
                this.updateRaid();
                this.presentToast(player.ingameName + ' wurde verschoben!');

            }, (e) => {
                console.log(e);
                this.presentToast('Da ist wohl was schiefgegangen 🤮');
            });
    }


    private async updateRaid() {
        let raidObs = await this.getRaid();
        raidObs
            .subscribe(
                (res) => {
                    console.log(res);
                    const raid = res.item;
                    this.raid = raid;
                },
                (error) => {
                    const statusCode = error.status;
                    if (statusCode === 404) {
                        console.log('nix gefunden');
                    }
                    if (statusCode === 500) {
                        console.log('something went wrong ' + error);
                    }

                }
            );
    }

    private async getRaid(): Promise<Observable<any>> {
        const token = await this.oktaAuth.getAccessToken();
        return this.http.get<Raid>(Backend.address + '/raid/' + this.raid._id, await Backend.getHttpOptions(token));

    }

    async presentConfirmCloseRaid() {
        const alert = await this.alertController.create({
            header: 'Raidanmeldung Schließen',
            message: 'Bist du dir Sicher, dass du den Raid Absagen möchtest, Spieler können sich dann nicht mehr registrieren.',
            buttons: [
                {
                    text: 'Raid Schließen',
                    handler: () => {
                        this.closeOrOpenRaid(true);
                    }
                },
                {
                    text: 'Abbrechen',
                    role: 'cancel',
                    cssClass: this.myChar.playerClass.toString().toLowerCase(),
                    handler: (blah) => {
                        console.log('Confirm Cancel: blah');
                    }
                }
            ]
        });

        await alert.present();
    }

    async presentConfirmStartRaid() {
        const alert = await this.alertController.create({
            header: 'Raid Starten?',
            message: 'Es werden die Antritts DKP Verteilt. Bist du dir Sicher, dass du den Raid Starten möchtest?',
            buttons: [
                {
                    text: 'Raid Starten',
                    handler: () => {
                        this.startRaid();
                    }
                },
                {
                    text: 'Abbrechen',
                    role: 'cancel',
                    cssClass: this.myChar.playerClass.toString().toLowerCase(),
                    handler: () => {

                    }
                }
            ]
        });

        await alert.present();
    }


    async closeOrOpenRaid(closeRaid: boolean) {
        const token = await this.oktaAuth.getAccessToken();
        const options = await Backend.getHttpOptions(token);
        const raid = this.raid;
        raid.isClosed = closeRaid;

        this.http.patch(Backend.address + '/raid/' + this.raid._id, this.raid, options)
            .subscribe((data) => {
                console.log('registration changed', data);
                let msg = 'Raidanmeldung wurde ';
                msg += closeRaid ? 'geschlossen' : 'wieder geöffnet';
                this.presentToast(msg);

            }, (e) => {
                console.log(e);
                this.presentToast('Da ist wohl was schiefgegangen 🤮');
            });
    }

    createDKPEntriesForPlayers(players: Player[], dkpLogType: DkpLogType, dkp: number, reason: string): DkpEntry[] {
        return players.map((p) => {
            return new DkpEntry(dkpLogType, reason, this.myChar.ingameName, new Date(), dkp, p.mail);
        });
    }


    changeReason(e) {
        this._reason = e.detail.value;
    }

    changeDkp(e) {
        this._dkp = e.detail.value;
    }

    async giveBossKillDKP() {


        const dkpEntries =
            this.createDKPEntriesForPlayers(this.raid.confirm.map(reg => reg.player), DkpLogType.Bosskill, 10, this._boss)
                .concat(this.createDKPEntriesForPlayers(this.raid.bench.map(reg => reg.player), DkpLogType.Bosskill, 5, this._boss + " (Ersatzbank)"));


        this.postDKPEntries(dkpEntries);

    }

    async postDKPEntries(dkpEntries: DkpEntry[]) {

        const token = await this.oktaAuth.getAccessToken();
        const options = await Backend.getHttpOptions(token);

        this.http.post(Backend.address + '/dkp/many', dkpEntries, options)
            .subscribe((data) => {
                console.log('dkp patch successful!', data);
                this.presentToast('DKP Update Erfolgreich!');
            }, (e) => {
                console.log(e);
                this.presentToast('Da ist wohl was schiefgegangen 🤮');
            });
    }

    async giveRaidStartDKP() {
        const token = await this.oktaAuth.getAccessToken();
        const options = await Backend.getHttpOptions(token);

        const dkpEntries =
            this.createDKPEntriesForPlayers(this.raid.confirm.map(reg => reg.player), DkpLogType.Bonus, 10, "Raidantritt")
                .concat(this.createDKPEntriesForPlayers(this.raid.bench.map(reg => reg.player), DkpLogType.Bonus, 10, "Raidantritt (Ersatzbank)"));


        this.http.post(Backend.address + '/dkp/many', dkpEntries, options)
            .subscribe((data) => {
                console.log('dkp patch successful!', data);
                this.presentToast('DKP Update Erfolgreich!');
            }, (e) => {
                console.log(e);
                this.presentToast('Da ist wohl was schiefgegangen 🤮');
            });

    }


    setBossKill(e) {
        this._boss = e.detail.value;
    }


    async startRaid() {
        const token = await this.oktaAuth.getAccessToken();
        const options = await Backend.getHttpOptions(token);
        const raid = this.raid;
        raid.hasStarted = true;

        this.http.patch(Backend.address + '/raid/' + this.raid._id, this.raid, options)
            .subscribe((data) => {
                this.presentToast("Raid gestartet");
                this.giveRaidStartDKP()

            }, (e) => {
                console.log(e);
                this.presentToast('Da ist wohl was schiefgegangen 🤮');
            });
    }

    postDkpEntriesForConfirmed() {
        const dkpEntries = this.createDKPEntriesForPlayers(this.raid.confirm.map(reg => reg.player), DkpLogType.Bonus, this.dkp, this.reason);
        this.postDKPEntries(dkpEntries);
    }
}

