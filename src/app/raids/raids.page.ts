import {Component, OnInit} from '@angular/core';
import {Settings} from '../Settings';
import {Observable} from 'rxjs';
import {Player} from '../models/Player';
import {Backend} from '../Backend';
import {OktaAuthService} from '@okta/okta-angular';
import {HttpClient} from '@angular/common/http';
import {Raid} from '../models/Raid';
import {ModalController} from '@ionic/angular';
import {CreateRaidComponent} from '../create-raid/create-raid.component';
import {ToastController} from '@ionic/angular';

@Component({
    selector: 'app-raids',
    templateUrl: './raids.page.html',
    styleUrls: ['./raids.page.scss'],
})
export class RaidsPage implements OnInit {
    private isModalPresent: any;
    raids: Raid[];
    status: string[] = [

    ];





    get myChar(): Player {
        return Settings.Instance.player;
    }


    constructor(
        private modalController: ModalController,
        private oktaAuth: OktaAuthService,
        private http: HttpClient,
        private toastController: ToastController) {
    }

    ngOnInit() {
        console.log('RAIDS ENTERED');
    }


    async ionViewDidEnter() {
        await this.updateRaids();
    }

    private async updateRaids() {
        let raidObs = await this.getRaids();
        raidObs
            .subscribe(
                (res) => {
                    const raids = res.data;
                    this.raids = raids;
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

    async showCreateRaidModal() {
        if (this.isModalPresent) {
            return;
        }
        this.isModalPresent = true;
        const modal = await this.modalController.create({
            component: CreateRaidComponent,
            componentProps: {}
        });
        await modal.present();
        modal.onDidDismiss().then((callback) => {
            if (callback.data) {
                const raid: Raid = callback.data.raid;
                this.postRaid(raid);
            }
            this.updateRaids();
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


    private async postRaid(raid: Raid) {
        const token = await this.oktaAuth.getAccessToken();
        const options = await Backend.getHttpOptions(token);

        this.http.post(Backend.address + '/raid', raid, options)
            .subscribe((data) => {
                console.log('raid creation successful!', data);
                this.presentToast('Yeah der Raid wurde erstellt!');
            }, (e) => {
                console.log(e);
                this.presentToast('Da ist wohl was schiefgegangen 🤮');
            });

    }

    private async getRaids(): Promise<Observable<any>> {
        const token = await this.oktaAuth.getAccessToken();
        return this.http.get<Raid>(Backend.address + '/raids', await Backend.getHttpOptions(token));
    }

    showSignUpModal() {
        this.presentToast("feature kommt bald 😎");
    }
}
