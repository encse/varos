#include <fstream.h>
#include <stdlib.h>
int Random(int a)
{ return random()%a;
}
main()
{ ofstream out("terkep.txt");
  int fugg,vizsz,hossz;
  cout << "Függőleges kereszteződések száma: ";
  cin >> fugg;
  cout << "Vízszintes kereszteződések száma: ";
  cin >> vizsz;
  cout << "Utcahosszok: ";
  cin >> hossz;

  out << fugg << " "<< vizsz << endl;
  for(int i=0;i<=fugg;i++) out << hossz <<" ";
  out << endl;
  for(int i=0;i<=vizsz;i++) out << hossz <<" ";
  out << endl;
  for(int i=0;i<fugg;i++)
  { for(int k=0;k<vizsz;k++)
    { out << Random(4)+1 << " " << Random(4) <<" ";

    }
    out << endl;
  }
}
