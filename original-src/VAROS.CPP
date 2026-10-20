#include <iostream.h>
#include "kereszt.h"
#include "varos.h"
#include <conio.h>
#include "grx20.h"
int screen_width, screen_height;
long int colors[16];

void setgraphmode()
{ GrSetMode(GR_default_graphics);
  screen_width=GrScreenX();
  screen_height=GrScreenY();
  colors[0]=GrAllocColor(0,0,0);
  colors[1]=GrAllocColor(65,3,147);
  colors[2]=GrAllocColor(221,220,223);
  colors[3]=GrAllocColor(48,160,132);
  colors[4]=GrAllocColor(4,69,154);
  colors[5]=GrAllocColor(100,161,186);
  colors[6]=GrAllocColor(143,168,142);
  colors[7]=GrAllocColor(64,0,64);
  colors[8]=GrAllocColor(170,170,170); //ház
  colors[9]=GrAllocColor(254,2,2); //piros lampa vilagos
  colors[10]=GrAllocColor(130,17,17); // piros lampa sotet
  colors[11]=GrAllocColor(68,207,33); //zöld lámpa világos
  colors[12]=GrAllocColor(64,64,64); //út
  colors[13]=GrAllocColor(252,215,3); //index
  colors[14]=GrAllocColor(202,216,250);
  colors[15]=GrAllocColor(255,255,255);
}
void closegraph()
{ //GrNumFreeColors();
  textmode(C80);
}
varos::varos(char *nev)
{ ifstream data(nev);
  int sx=-1,sy=-1;
  if(!data)
  { cout << "Nem sikerült megnyitni a következőt: " << nev << endl;
    hiba = 1;
  }
  else
  { data >> varosfilename;
    data >> autofilename;
    autofile.open(autofilename);
    varosfile.open(varosfilename);
    varosfile >> fuggUtcak;
    varosfile >> vizszUtcak;
    keresztezodesek= new Kereszt[(fuggUtcak+2)*(vizszUtcak+2)];
    vizszUtcaHossz= new int[fuggUtcak+1];
    fuggUtcaHossz= new int[vizszUtcak+1];

    for(int i=0; i <= fuggUtcak; i++)
    { varosfile >> vizszUtcaHossz[i];
    }
    for(int i=0; i <= vizszUtcak; i++)
    { varosfile >> fuggUtcaHossz[i];
    }

    setgraphmode();
    int s=0;
    for(int i=0;i<=fuggUtcak;i++) s+=vizszUtcaHossz[i];
    s+=(fuggUtcak*2);
    int z=0;
    for(int i=0;i<=vizszUtcak;i++) z+=fuggUtcaHossz[i];
    z+=(vizszUtcak*2);
    if(screen_width/s < screen_height/z)
    { EGYSEG=(int)screen_width/s;
      ELTOL_X=0;
      ELTOL_Y=(screen_height-z*EGYSEG)/2;
    }
    else
    { EGYSEG=(int)screen_height/z;
      ELTOL_X=(screen_width-s*EGYSEG)/2;
      ELTOL_Y=0;
    }
    //i felülről lefelé halad
    for(int i=0;i<vizszUtcak+2; i++)
    { sx=-1;   //1230
      //k balról jobbra halad
      for(int k=0;k<fuggUtcak+2; k++)
      { init.where.x=sx;
	init.where.y=sy;
	//Alsó szomszéd
	if (i!=vizszUtcak+1)
	  init.szomszedok[1]=keresztezodesek+((i+1)*(fuggUtcak+2)+k);
	else init.szomszedok[1]=NULL;
      //Bal szomszéd
	if (k)
	  init.szomszedok[2]=keresztezodesek+( i*(fuggUtcak+2)+k-1);
	else init.szomszedok[2]=NULL;
      //Felső szomszéd
	if (i)
	  init.szomszedok[3]=keresztezodesek+((i-1)*(fuggUtcak+2)+k);
	else init.szomszedok[3]=NULL;
      //Jobb oldali szomszéd
	if (k!=fuggUtcak+1)
	  init.szomszedok[0]=keresztezodesek+(i*(fuggUtcak+2)+k+1);
	else init.szomszedok[0]=NULL;

	if(i>0 && i<vizszUtcak+1 && k>0 && k<fuggUtcak+1)
	{ varosfile >> init.periodusido;
	  varosfile >> init.melyikZold;
	  init.tipus=KERESZT_NORM;
	  init.uthosszok[0]=fuggUtcaHossz[i];
	  init.uthosszok[1]=vizszUtcaHossz[k-1];
	  init.uthosszok[2]=fuggUtcaHossz[i-1];
	  init.uthosszok[3]=vizszUtcaHossz[k];
	}
	else
	{ init.periodusido=-1;
	  for(int j=0;j<4;j++)init.uthosszok[j]=0;
	  init.melyikZold=-1;
	  if(!i) init.melyikZold=0,init.uthosszok[0]=fuggUtcaHossz[0];
	  else if(!k) init.melyikZold=3,init.uthosszok[3]=vizszUtcaHossz[0];
	  else if(i==vizszUtcak+1&&k!=fuggUtcak+1) init.melyikZold=2,init.uthosszok[2]=fuggUtcaHossz[vizszUtcak];
	  else if(i!=vizszUtcak+1) init.melyikZold=1,init.uthosszok[1]=vizszUtcaHossz[fuggUtcak];
	  init.tipus=KERESZT_SPEC;
	}
	keresztezodesek[i*(fuggUtcak+2)+k].Beallit(init);
	keresztezodesek[i*(fuggUtcak+2)+k].EGYSEG=EGYSEG;
	keresztezodesek[i*(fuggUtcak+2)+k].ELTOL_X=ELTOL_X;
	keresztezodesek[i*(fuggUtcak+2)+k].ELTOL_Y=ELTOL_Y;
	sx=sx+(vizszUtcaHossz[k]+2);
      }
      sy=sy+(fuggUtcaHossz[i]+2);
    }

    autofile >> autokszama;
    carptr= new Auto[autokszama];
    last=var=0;
  }
  sx-=(vizszUtcaHossz[fuggUtcak+1]+3);
  sy-=(fuggUtcaHossz[vizszUtcak+1]+3);
  GrFilledBox(ELTOL_X,ELTOL_Y,sx*EGYSEG+ELTOL_X,sy*EGYSEG+ELTOL_Y,12);
  for(int i=0;i<autokszama;i++)carptr[i].init(EGYSEG,ELTOL_X,ELTOL_Y);
  kirajzol();

}
varos::~varos(void)
{ closegraph();
  delete []vizszUtcaHossz;
  delete []fuggUtcaHossz;
  delete []carptr;
  delete []keresztezodesek;
}
void varos::go(void)
{ int s=(fuggUtcak+2)*(vizszUtcak+2)-1;
  int dirty=1;
  kirajzol();
  for(int i=0;i<=s;i++)
    keresztezodesek[i].ujkor();
  //Addig kell újravizsgálni a kereszteződéseket, ameddig volt bennük mozgás.
  while(dirty)
  { dirty=0;
    for(int i=0;i<=s;i++)
      if(keresztezodesek[i].clock()) dirty=1;
  }
  beolvas();
  //Azért olvasunk ilyen későn, mert előbb mozgatjuk a város utcáit.
  //olvasás után megint mozgatni kell az utcákat, hogy az új autók
  //is lépegethessenek, amennyire tudnak.
  dirty=1;
  while(dirty)
  { dirty=0;
    for(int i=0;i<=s;i++)
      if(keresztezodesek[i].clock()) dirty=1;
  }
}

void varos::kirajzol(void)
{ int x1, x2;
  int y1=0;
  int y2=(fuggUtcaHossz[0]*EGYSEG);
  for(int k=1;k<=vizszUtcak+1;k++)
  { x1=0;
    x2=(vizszUtcaHossz[0]*EGYSEG);
    for (int i=1;i<=fuggUtcak+1;i++)
    { GrFilledBox(x1+ELTOL_X,y1+ELTOL_Y,x2+ELTOL_X,y2+(int)ELTOL_Y,8);
      if(i<fuggUtcak+1)x1=x2+2*EGYSEG; x2=x2+((vizszUtcaHossz[i]+2)*EGYSEG);
    }
    if(k<vizszUtcak+1)y1=y2+2*EGYSEG; y2=y2+((fuggUtcaHossz[k]+2)*EGYSEG);
  }

}
void varos::beolvas()
{ int i;
  for(i=0;i<last;i++) if ( carptr[i].allapot==AUTO_VAR && betesz(carptr[i])) carptr[i].allapot=AUTO_MEGY,var--;

  while(last<autokszama && carptr[last].read(autofile))
  { if(!betesz(carptr[last])) carptr[last].allapot=AUTO_VAR,var++;
    last++;
  }
}
int varos::betesz(Auto &car)
{ int s=0;
  int magassag=0;
  int szelesseg=0;
  int be=-1;
  for(int i=0;i<vizszUtcak+1;i++) magassag+=fuggUtcaHossz[i];
  magassag+=(vizszUtcak*2);
  for(int i=0;i<fuggUtcak+1;i++) szelesseg+=vizszUtcaHossz[i];
  szelesseg+=(fuggUtcak*2);
  if( car.position().x==0 )
    for(int i=fuggUtcak+3;i<=(vizszUtcak+1)*(fuggUtcak+2);i+=(fuggUtcak+2))
      {if (car.position().y==keresztezodesek[i].position().y+1) s=keresztezodesek[i].utak[1]->in(&car), be=i;
      }
  if( car.position().y==0)
    for(int i=fuggUtcak+3;i<=(fuggUtcak+1)*2;i++)
     {if (car.position().x==keresztezodesek[i].position().x) s=keresztezodesek[i].utak[2]->in(&car), be=i;
     }
  if( car.position().x==szelesseg+1)
    for(int i=(fuggUtcak+1)*2;i<=(vizszUtcak+2)*(fuggUtcak+1)-1;i+=(fuggUtcak+2))
     {if (car.position().y==keresztezodesek[i].position().y) s=keresztezodesek[i].utak[3]->in(&car), be=i;
     }
  if( car.position().y==magassag+1)
    for(int i=(fuggUtcak+2)*(vizszUtcak)+1;i<=(vizszUtcak+1)*(fuggUtcak+2)-2;i++)
     { if (car.position().x==keresztezodesek[i].position().x+1) s=keresztezodesek[i].utak[0]->in(&car), be=i;
     }
  return s;
}
