import {Component, OnInit} from '@angular/core';
import {Player} from '../models/Player';
import {Settings} from '../Settings';
import {CreateUserComponent} from '../create-user/create-user.component';
import {Observable} from 'rxjs';
import {Backend} from '../Backend';
import {ModalController} from '@ionic/angular';
import {OktaAuthService} from '@okta/okta-angular';
import {HttpClient} from '@angular/common/http';
import {ChangeUserComponent} from '../change-user/change-user.component';

@Component({
    selector: 'app-player-widget',
    templateUrl: './player-widget.component.html',
    styleUrls: ['./player-widget.component.scss'],
})
export class PlayerWidgetComponent implements OnInit {
    get player(): Player {
        return Settings.Instance.player;
    }


    constructor(
        private modalController: ModalController,
        private oktaAuth: OktaAuthService,
        private http: HttpClient) {
    }

    async ngOnInit() {
        await this.updatePlayer();
    }

    public async updatePlayer() {
        const token = await this.oktaAuth.getAccessToken();
        const user = await this.oktaAuth.getUser();

        if (!token || !user) {
            this.oktaAuth.loginRedirect('/tabs');

        } else {
            let playerObservable = await this.getPlayerRequest(user, token);
            playerObservable
                .subscribe(
                    (res) => {
                        const player = res.player;
                        Settings.Instance.player = player;
                    },
                    (error) => {
                        const statusCode = error.status;
                        if (statusCode === 404) {
                            this.showCreateProfileModal();
                        }
                        if (statusCode === 500) {
                            console.log('something went wrong ' + error);
                        }

                    }
                );
        }
    }

    private async getPlayerRequest(user, token): Promise<Observable<any>> {
        return this.http.get<Player>(Backend.address + '/player' + user.mail, await Backend.getHttpOptions(token));
    }

    async showCreateProfileModal() {
        const modal = await this.modalController.create({
            component: CreateUserComponent,
            componentProps: {
                'modalController': this.modalController,
                'player': await this.oktaAuth.getUser()
            }
        });

        modal.onDidDismiss().then(() => {
            console.log('The result:');
        });
        return await modal.present();
    }


    async showChangeUserModal() {
        const modal = await this.modalController.create({
            component: ChangeUserComponent,
            componentProps: {
                'modalController': this.modalController,
                'player': await this.oktaAuth.getUser(),
                // used to call updatePlayer after closing modal
                'parent': this
            }
        });


        return await modal.present();
    }
}
